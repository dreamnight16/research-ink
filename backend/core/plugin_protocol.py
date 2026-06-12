from typing import Any, Protocol

from fastapi import APIRouter


class PluginProtocol(Protocol):
    name: str
    display_name: str
    version: str

    async def on_load(self, bus: Any, config: dict[str, Any]) -> None: ...
    async def on_unload(self) -> None: ...
    def get_routes(self) -> APIRouter | None: ...
