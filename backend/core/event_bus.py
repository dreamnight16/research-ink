import asyncio
import logging
from collections import defaultdict
from collections.abc import Callable, Coroutine
from typing import Any

Handler = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]
logger = logging.getLogger(__name__)


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def on(self, event: str, handler: Handler) -> None:
        self._handlers[event].append(handler)

    def off(self, event: str, handler: Handler) -> None:
        if event in self._handlers:
            self._handlers[event] = [
                h for h in self._handlers[event] if h is not handler
            ]

    async def emit(self, event: str, data: dict[str, Any]) -> None:
        handlers = list(self._handlers.get(event, []))
        if not handlers:
            return
        results = await asyncio.gather(
            *[handler(data) for handler in handlers], return_exceptions=True
        )
        for result in results:
            if isinstance(result, Exception):
                logger.error(
                    "EventBus handler for '%s' raised: %s", event, result,
                    exc_info=result,
                )
