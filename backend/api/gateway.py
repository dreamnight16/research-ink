# backend/api/gateway.py
import hashlib
import json
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.api.middleware import (
    MaxBodySizeMiddleware,
    RequestLoggingMiddleware,
    add_ws_ticket,
    auth_skip_paths,
    check_ws_connection_limit,
    consume_ws_ticket,
    rate_limit_middleware,
    release_ws_connection,
)
from backend.core.config import Config
from backend.core.engine import PluginEngine
from backend.core.event_bus import EventBus
from backend.core.llm_router import LLMRouter
from backend.core.scheduler import TaskScheduler
from backend.core.schema import ensure_schema
from backend.core.security import Classification, SecurityManager
from backend.core.storage import Storage

logger = logging.getLogger(__name__)

_PAIR_CODE_TTL_SECONDS = 300


class ChatRequest(BaseModel):
    messages: list[dict] = Field(..., max_length=100)
    classification: str = Field(max_length=20, pattern=r"^(secret|cautious|public)$")
    doc_id: str = Field(max_length=200)


class ClassifyRequest(BaseModel):
    doc_id: str = Field(max_length=200)
    level: str = Field(max_length=20, pattern=r"^(secret|cautious|public)$")


class SearchRequest(BaseModel):
    collection: str = Field(max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
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
            with open(token_path) as f:
                return f.read().strip()
    except (OSError, PermissionError):
        pass
    token = secrets.token_hex(32)
    os.makedirs(os.path.dirname(token_path), exist_ok=True)
    with open(token_path, "w") as f:
        f.write(token)
    # 限制文件权限（Unix）
    with suppress(OSError, NotImplementedError):
        os.chmod(token_path, 0o600)
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
    security = SecurityManager(storage=storage)
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
        ensure_schema(storage)
        await scheduler.start()
        # Load plugins on startup
        manifests = engine.discover_all()
        for manifest in manifests:
            await engine.load_plugin_from_path(manifest["path"], manifest["name"])
        # Register plugin routes
        for plugin in engine.list_plugins().values():
            router = plugin.get_routes()
            if router:
                app.include_router(router)
        logger.info("All plugins loaded: %s", list(engine.list_plugins().keys()))
        # Register auto-crawl for literature plugin
        if "literature" in engine.list_plugins():
            async def auto_crawl():
                import json

                from backend.plugins.literature.crawlers import CrawlerManager
                from backend.plugins.literature.crawlers.arxiv import ArxivCrawler
                from backend.plugins.literature.crawlers.dblp import DBLPCrawler
                from backend.plugins.literature.crawlers.semantic_scholar import (
                    SemanticScholarCrawler,
                )
                manager = CrawlerManager()
                manager.register(ArxivCrawler())
                manager.register(SemanticScholarCrawler())
                manager.register(DBLPCrawler())
                try:
                    rows = storage.sql_query(
                        "SELECT value FROM kv WHERE key = 'literature_interests'"
                    )
                    keywords = json.loads(rows[0]["value"]) if rows else ["machine learning"]
                except (json.JSONDecodeError, IndexError):
                    keywords = ["machine learning"]
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
        await llm_router.close()
        storage.close()

    app = FastAPI(title="研墨", version="1.0.0", lifespan=lifespan)

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "type": type(exc).__name__},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    # 生成本地 API 认证 token（首次启动后固定）
    auth_token = _load_or_generate_token(config)
    app.state.auth_token = auth_token
    logger.info("API auth token initialized")

    skip_paths = auth_skip_paths()

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if request.url.path in skip_paths:
            return await call_next(request)
        token = request.headers.get("Authorization", "").lower().removeprefix("bearer ").strip()
        if not secrets.compare_digest(token, app.state.auth_token):
            raise HTTPException(status_code=401, detail="Unauthorized")
        return await call_next(request)

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        return await rate_limit_middleware(request, call_next)

    app.add_middleware(MaxBodySizeMiddleware, max_size=5 * 1024 * 1024)
    app.add_middleware(RequestLoggingMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173", "http://localhost:5174",
            "tauri://localhost", "https://tauri.localhost",
            "capacitor://localhost",
        ],
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
    async def health(request: Request):
        checks: dict[str, str] = {}
        # Ollama connectivity
        try:
            import httpx
            async with httpx.AsyncClient() as c:
                r = await c.get(f"{config.ollama_base_url}/api/tags", timeout=3)
                checks["ollama"] = "ok" if r.status_code == 200 else "error"
        except Exception:
            checks["ollama"] = "unreachable"
        # SQLite
        try:
            storage.sql_query("SELECT 1")
            checks["sqlite"] = "ok"
        except Exception:
            checks["sqlite"] = "error"
        # ChromaDB
        try:
            storage.chroma_collection("_health_check")
            checks["chromadb"] = "ok"
        except Exception:
            checks["chromadb"] = "error"
        all_ok = all(v == "ok" for v in checks.values())
        return {"status": "healthy" if all_ok else "degraded", "checks": checks}

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
        await add_ws_ticket(ticket)
        return {"ticket": ticket}

    @app.post("/api/auth/rotate-token")
    async def rotate_token(request: Request):
        """生成新 API token，旧 token 立即失效。需要旧 token 认证。"""
        new_token = secrets.token_hex(32)
        token_path = os.path.join(request.app.state.config.data_dir, ".api_token")
        with open(token_path, "w") as f:
            f.write(new_token)
        with suppress(OSError, NotImplementedError):
            os.chmod(token_path, 0o600)
        request.app.state.auth_token = new_token
        logger.info("API auth token rotated")
        return {"token": new_token}

    @app.post("/api/auth/pair/generate")
    async def generate_pair_code(request: Request):
        """生成 6 位配对码并存储到 app.state（带过期时间）。"""
        code = f"{secrets.randbelow(1_000_000):06d}"
        request.app.state.pair_code = code
        request.app.state.pair_code_expires = time.monotonic() + _PAIR_CODE_TTL_SECONDS
        logger.info("Pairing code generated")
        return {"code": code}

    @app.post("/api/auth/pair")
    async def pair_device(request: Request):
        """移动端配对：用 6 位配对码交换 API token。"""
        body = await request.json()
        pair_code = str(body.get("code", ""))
        expected = getattr(request.app.state, "pair_code", None)
        expires = getattr(request.app.state, "pair_code_expires", 0.0)
        if (
            expected is None
            or expires < time.monotonic()
            or not secrets.compare_digest(pair_code, str(expected))
        ):
            raise HTTPException(status_code=403, detail="Invalid pair code")
        request.app.state.pair_code = None  # 一次性使用
        request.app.state.pair_code_expires = 0.0
        host = request.client.host if request.client else ""
        return {"token": request.app.state.auth_token, "host": host}

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

    @app.post("/api/security/approve-cloud/{doc_id}")
    async def approve_cloud(doc_id: str, request: Request):
        sec = request.app.state.security
        sec.approve_cloud(doc_id)
        return {"status": "ok"}

    @app.get("/api/security/audit-log")
    async def audit_log(request: Request, limit: int = 100, offset: int = 0):
        sec = request.app.state.security
        return {"entries": sec.audit_log(limit=limit, offset=offset)}

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
        logger.info(
            "Settings updated (cloud_api_key %s)",
            "changed" if req.cloud_api_key else "unchanged",
        )
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
        if not await check_ws_connection_limit():
            await ws.close(code=4002, reason="Too many connections")
            return
        ticket = ws.query_params.get("ticket", "")
        if not await consume_ws_ticket(ticket):
            await ws.close(code=4001, reason="Unauthorized")
            release_ws_connection()
            return
        await ws.accept()
        # Forward event bus events to WebSocket
        async def forward(data: dict):
            try:
                await ws.send_json({"event": "paper.saved", "data": data})
            except Exception:
                logger.warning("WS forward failed", exc_info=True)

        bus.on("paper.saved", forward)
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            bus.off("paper.saved", forward)
        finally:
            release_ws_connection()

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
