from fastapi import APIRouter

from backend.core.base_plugin import BasePlugin


class PaperWriterPlugin(BasePlugin):
    name = "paper_writer"
    display_name = "写论文"
    version = "0.1.0"

    async def on_load(self, bus, config):
        self._bus = bus
        self._config = config

    async def on_unload(self):
        pass

    def get_routes(self) -> APIRouter:
        from backend.plugins.paper_writer.routes import create_router
        return create_router(self)


Plugin = PaperWriterPlugin
