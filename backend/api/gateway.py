# backend/api/gateway.py
import hashlib
import importlib
import json
import logging
import os
import secrets
import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.core.engine import PluginEngine
from backend.core.event_bus import EventBus
from backend.core.config import Config
from backend.core.storage import Storage
from backend.core.security import SecurityManager, Classification
from backend.core.llm_router import LLMRouter
from backend.core.scheduler import TaskScheduler

logger = logging.getLogger(__name__)

# In-memory rate limiter: {client_ip: [timestamps]}
_rate_limits: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_WINDOW = 60   # seconds
_RATE_LIMIT_MAX = 60       # requests per window

# Short-lived WebSocket tickets to avoid exposing auth token in URL
_ws_tickets: dict[str, float] = {}


class ChatRequest(BaseModel):
    messages: list[dict] = Field(..., max_length=100)
    classification: str = Field(max_length=20)
    doc_id: str = Field(max_length=200)


class ClassifyRequest(BaseModel):
    doc_id: str = Field(max_length=200)
    level: str = Field(max_length=20)


class SearchRequest(BaseModel):
    collection: str = Field(max_length=100)
    query: str = Field(max_length=1000)
    n: int = Field(default=5, ge=1, le=100)


class SettingsUpdate(BaseModel):
    ollama_base_url: str = Field(default="", max_length=256)
    ollama_model: str = Field(default="", max_length=128)
    cloud_provider: str = Field(default="", max_length=64)
    cloud_api_key: str = Field(default="", max_length=256)
    cloud_model: str = Field(default="", max_length=128)


def _hash_messages(messages: list[dict]) -> str:
    """Deterministic SHA-256 hash of messages for audit trail."""
    canonical = json.dumps(messages, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def _load_or_generate_token(config: Config) -> str:
    """加载或生成本地 API 认证 token，持久化到 config。"""
    token_path = os.path.join(config.data_dir, ".api_token")
    try:
        if os.path.exists(token_path):
            with open(token_path, "r") as f:
                return f.read().strip()
    except (OSError, PermissionError):
        pass
    token = secrets.token_hex(32)
    os.makedirs(os.path.dirname(token_path), exist_ok=True)
    with open(token_path, "w") as f:
        f.write(token)
    # 限制文件权限（Unix）
    try:
        os.chmod(token_path, 0o600)
    except (OSError, NotImplementedError):
        pass
    return token


def _rebuild_llm_router(config: Config, app: FastAPI) -> None:
    """Rebuild LLMRouter from current config — called after settings update."""
    app.state.llm_router = LLMRouter(
        ollama_base_url=config.ollama_base_url,
        ollama_model=config.ollama_model,
        cloud_provider=config.cloud_provider,
        cloud_api_key=config.cloud_api_key,
        cloud_model=config.cloud_model,
    )


def create_app(config: Config) -> FastAPI:
    bus = EventBus()
    storage = Storage(config.data_dir)
    security = SecurityManager()
    scheduler = TaskScheduler(tick_interval=30.0)
    llm_router = LLMRouter(
        ollama_base_url=config.ollama_base_url,
        ollama_model=config.ollama_model,
        cloud_provider=config.cloud_provider,
        cloud_api_key=config.cloud_api_key,
        cloud_model=config.cloud_model,
    )
    engine = PluginEngine(bus=bus, config=config.to_dict())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await scheduler.start()
        # Load plugins on startup
        manifests = engine.discover_all()
        for manifest in manifests:
            await engine.load_plugin_from_path(manifest["path"], manifest["name"])
        # Register plugin routes
        for name, plugin in engine.list_plugins().items():
            router = plugin.get_routes()
            if router:
                app.include_router(router)
        logger.info("All plugins loaded: %s", list(engine.list_plugins().keys()))
        # Register auto-crawl for literature plugin
        if "literature" in engine.list_plugins():
            async def auto_crawl():
                from backend.plugins.literature.crawlers import CrawlerManager
                from backend.plugins.literature.crawlers.arxiv import ArxivCrawler
                from backend.plugins.literature.crawlers.semantic_scholar import SemanticScholarCrawler
                from backend.plugins.literature.crawlers.dblp import DBLPCrawler
                import json
                manager = CrawlerManager()
                manager.register(ArxivCrawler())
                manager.register(SemanticScholarCrawler())
                manager.register(DBLPCrawler())
                rows = storage.sql_query("SELECT value FROM kv WHERE key = 'literature_interests'")
                keywords = json.loads(rows[0]["value"]) if rows else ["machine learning"]
                count = 0
                for kw in keywords[:3]:
                    result = await manager.search_all(kw, max_results=5)
                    count += len(result.papers)
                if count > 0:
                    await bus.emit("paper.saved", {"count": count, "auto": True})
                logger.info("Auto-crawl: %d new papers", count)
            scheduler.add("literature-auto-crawl", auto_crawl, interval_seconds=3600)
        yield
        await scheduler.stop()
        await engine.shutdown()

    app = FastAPI(title="研墨", version="0.1.0", lifespan=lifespan)

    # 生成本地 API 认证 token（首次启动后固定）
    auth_token = _load_or_generate_token(config)
    app.state.auth_token = auth_token
    logger.info("API auth token initialized (first 8 chars): %s...", auth_token[:8])

    AUTH_SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/api/auth/token", "/api/ws/ticket"}

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        # 跳过健康检查等公开端点
        if request.url.path in AUTH_SKIP_PATHS:
            return await call_next(request)
        token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        if token != app.state.auth_token:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return await call_next(request)

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = _rate_limits[client_ip]
        window[:] = [t for t in window if now - t < _RATE_LIMIT_WINDOW]
        if len(window) >= _RATE_LIMIT_MAX:
            raise HTTPException(status_code=429, detail="Too Many Requests")
        window.append(now)
        return await call_next(request)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:5174", "tauri://localhost", "https://tauri.localhost"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.state.bus = bus
    app.state.storage = storage
    app.state.security = security
    app.state.scheduler = scheduler
    app.state.llm_router = llm_router
    app.state.engine = engine
    app.state.config = config

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/auth/token")
    async def get_token(request: Request):
        """返回本地 API token，仅允许 localhost 请求。"""
        host = request.client.host if request.client else ""
        if host not in ("127.0.0.1", "::1", "localhost"):
            raise HTTPException(status_code=403, detail="Forbidden")
        return {"token": app.state.auth_token}

    @app.get("/api/ws/ticket")
    async def get_ws_ticket(request: Request):
        """生成一次性 WebSocket ticket（30 秒有效），避免在 URL 中暴露 token。"""
        ticket = secrets.token_urlsafe(32)
        _ws_tickets[ticket] = time.time() + 30
        return {"ticket": ticket}

    @app.get("/api/plugins")
    async def list_plugins():
        return [
            {"name": name, "display_name": p.__class__.__name__}
            for name, p in engine.list_plugins().items()
        ]

    @app.post("/api/chat")
    async def chat(req: ChatRequest, request: Request):
        sec = request.app.state.security
        llm = request.app.state.llm_router

        sec.mark(req.doc_id, Classification(req.classification))
        approved = sec.allow_cloud(req.doc_id)
        provider = llm.select(classification=req.classification, cloud_approved=approved)

        content_hash = _hash_messages(req.messages)
        if provider.value != "ollama":
            sec.log_cloud_send(req.doc_id, llm.cloud_model, content_hash)

        result = await llm.chat(provider, req.messages)
        return {"content": result, "provider": provider.value}

    @app.post("/api/security/classify")
    async def classify(req: ClassifyRequest, request: Request):
        sec = request.app.state.security
        sec.mark(req.doc_id, Classification(req.level))
        return {"status": "ok"}

    @app.get("/api/security/allow-cloud/{doc_id}")
    async def allow_cloud(doc_id: str, request: Request):
        sec = request.app.state.security
        allowed = sec.allow_cloud(doc_id)
        return {"allowed": allowed}

    @app.get("/api/security/audit-log")
    async def audit_log(request: Request):
        sec = request.app.state.security
        return {"entries": sec.audit_log()}

    @app.get("/api/settings")
    async def get_settings(request: Request):
        cfg = request.app.state.config
        return cfg.to_dict()

    @app.put("/api/settings")
    async def update_settings(req: SettingsUpdate, request: Request):
        cfg = request.app.state.config
        for key, val in req.model_dump(exclude_unset=True).items():
            if hasattr(cfg, key):
                setattr(cfg, key, val)
        cfg.save()
        _rebuild_llm_router(cfg, request.app)
        logger.info("Settings updated (cloud_api_key %s)", "changed" if req.cloud_api_key else "unchanged")
        return {"status": "ok"}

    @app.post("/api/knowledge/search")
    async def search_knowledge(req: SearchRequest, request: Request):
        storage = request.app.state.storage
        collection = storage.chroma_collection(req.collection)
        results = collection.query(query_texts=[req.query], n_results=req.n)
        return {"results": results.get("ids", [[]])}

    # Set up plugin directories
    builtin_plugins_dir = os.path.join(os.path.dirname(__file__), "..", "plugins")
    user_plugins_dir = os.path.join(config.data_dir, "plugins")
    engine.set_user_plugins_dir(user_plugins_dir)
    engine._plugin_dirs = [builtin_plugins_dir, user_plugins_dir]

    # WebSocket for real-time push
    @app.websocket("/api/ws")
    async def websocket_endpoint(ws: WebSocket):
        # 使用一次性 ticket 替代长期 token，避免凭据在 URL 中暴露
        ticket = ws.query_params.get("ticket", "")
        now = time.time()
        for t in list(_ws_tickets.keys()):
            if _ws_tickets[t] < now:
                del _ws_tickets[t]
        if ticket not in _ws_tickets:
            await ws.close(code=4001, reason="Unauthorized")
            return
        del _ws_tickets[ticket]  # 一次性使用
        await ws.accept()
        # Forward event bus events to WebSocket
        async def forward(data: dict):
            try:
                await ws.send_json({"event": "paper.saved", "data": data})
            except Exception:
                pass

        bus.on("paper.saved", forward)
        try:
            while True:
                await ws.receive_text()  # keep alive
        except WebSocketDisconnect:
            bus.off("paper.saved", forward)

    # Scheduler routes
    @app.get("/api/scheduler")
    async def scheduler_status(request: Request):
        sched = request.app.state.scheduler
        return {"tasks": sched.list_tasks()}

    @app.post("/api/scheduler/{name}/run")
    async def scheduler_run(name: str, request: Request):
        sched = request.app.state.scheduler
        ok = await sched.run_once(name)
        return {"status": "ok" if ok else "not_found"}

    # Plugin management routes
    @app.get("/api/plugins/available")
    async def available_plugins():
        manifests = engine.discover_all()
        loaded = set(engine.list_plugins().keys())
        return {
            "plugins": [
                {**m, "loaded": m["name"] in loaded}
                for m in manifests
            ]
        }

    @app.post("/api/plugins/{name}/load")
    async def load_single_plugin(name: str):
        manifests = engine.discover_all()
        match = next((m for m in manifests if m["name"] == name), None)
        if not match:
            return {"status": "error", "message": "Plugin not found"}
        if name in engine.list_plugins():
            return {"status": "ok", "message": "Already loaded"}
        ok = await engine.load_plugin_from_path(match["path"], name)
        if ok:
            plugin = engine._plugins.get(name)
            if plugin:
                router = plugin.get_routes()
                if router:
                    app.include_router(router)
            return {"status": "ok"}
        return {"status": "error", "message": "Failed to load plugin"}

    @app.post("/api/plugins/{name}/unload")
    async def unload_single_plugin(name: str):
        if name not in engine.list_plugins():
            return {"status": "error", "message": "Plugin not loaded"}
        await engine.unload_plugin(name)
        return {"status": "ok"}

    return app
