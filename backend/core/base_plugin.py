from fastapi import APIRouter


class BasePlugin:
    name: str = "base"
    display_name: str = "Base"
    version: str = "0.1.0"

    async def on_load(self, bus, config) -> None:
        pass

    async def on_unload(self) -> None:
        pass

    def get_routes(self) -> APIRouter | None:
        return None
