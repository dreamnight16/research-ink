"""Middleware helpers for the FastAPI application."""

import asyncio
import logging
import time
from collections import OrderedDict, defaultdict

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ---- Rate limiter ----

_rate_limits: dict[str, list[float]] = defaultdict(list)
_rate_lock = asyncio.Lock()
_RATE_LIMIT_WINDOW = 60
_RATE_LIMIT_MAX = 60
_RATE_LIMIT_MAX_IPS = 10000

# ---- WebSocket tickets ----

_ws_tickets: OrderedDict[str, float] = OrderedDict()
_ws_lock = asyncio.Lock()
_WS_TICKET_TTL = 30
_WS_TICKET_MAX = 1000
_WS_MAX_CONNECTIONS = 50
_ws_connection_count = 0


def auth_skip_paths() -> set[str]:
    return {"/api/health", "/docs", "/openapi.json", "/api/auth/token"}


async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    async with _rate_lock:
        window = _rate_limits[client_ip]
        window[:] = [t for t in window if now - t < _RATE_LIMIT_WINDOW]
        if len(window) >= _RATE_LIMIT_MAX:
            raise HTTPException(status_code=429, detail="Too Many Requests")
        window.append(now)
        if len(_rate_limits) > _RATE_LIMIT_MAX_IPS:
            stale = [ip for ip, ts_list in _rate_limits.items()
                      if all(now - t > _RATE_LIMIT_WINDOW for t in ts_list)]
            for ip in stale:
                del _rate_limits[ip]
    return await call_next(request)


async def add_ws_ticket(ticket: str) -> None:
    async with _ws_lock:
        while len(_ws_tickets) >= _WS_TICKET_MAX:
            _ws_tickets.popitem(last=False)
        _ws_tickets[ticket] = time.time() + _WS_TICKET_TTL


async def consume_ws_ticket(ticket: str) -> bool:
    async with _ws_lock:
        now = time.time()
        for t in list(_ws_tickets.keys()):
            if _ws_tickets[t] < now:
                del _ws_tickets[t]
        if ticket in _ws_tickets:
            del _ws_tickets[ticket]
            return True
        return False


async def check_ws_connection_limit() -> bool:
    global _ws_connection_count
    if _ws_connection_count >= _WS_MAX_CONNECTIONS:
        return False
    _ws_connection_count += 1
    return True


def release_ws_connection() -> None:
    global _ws_connection_count
    _ws_connection_count = max(0, _ws_connection_count - 1)


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_size: int = 5 * 1024 * 1024):
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_size:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        logger.info(
            "%s %s → %s (%.0fms)",
            request.method, request.url.path, response.status_code, duration_ms,
        )
        return response
