from fastapi import APIRouter

from backend.core.base_plugin import BasePlugin


class TermAdvisorPlugin(BasePlugin):
    name = "term_advisor"
    display_name = "读懂导师"
    version = "0.1.0"

    async def on_load(self, bus, config):
        self._bus = bus
        self._config = config

    async def on_unload(self):
        pass

    def get_routes(self) -> APIRouter:
        from backend.plugins.term_advisor.routes import create_router
        return create_router(self)


Plugin = TermAdvisorPlugin
