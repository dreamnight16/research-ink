"""Hello World — A minimal example plugin for ResearchInk."""
from fastapi import APIRouter
from backend.core.base_plugin import BasePlugin


class HelloWorldPlugin(BasePlugin):
    name = "hello-world"
    display_name = "Hello World"
    version = "0.1.0"

    async def on_load(self, bus, config):
        self._bus = bus

    async def on_unload(self):
        pass

    def get_routes(self) -> APIRouter:
        router = APIRouter(prefix="/api/hello-world", tags=["hello-world"])

        @router.get("/greet")
        async def greet():
            return {"message": "Hello from ResearchInk plugin!"}

        return router


Plugin = HelloWorldPlugin
