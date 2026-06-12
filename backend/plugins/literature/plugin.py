from fastapi import APIRouter

from backend.core.base_plugin import BasePlugin


class LiteraturePlugin(BasePlugin):
    name = "literature"
    display_name = "追新论文"
    version = "0.1.0"

    async def on_load(self, bus, config):
        self._bus = bus
        self._config = config

    async def on_unload(self):
        pass

    def get_routes(self) -> APIRouter:
        from backend.plugins.literature.routes import create_router
        return create_router(self)


Plugin = LiteraturePlugin
