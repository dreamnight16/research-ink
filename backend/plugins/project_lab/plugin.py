"""Project Lab plugin — registers routes and hooks."""
import logging

from fastapi import APIRouter

from backend.core.base_plugin import BasePlugin

logger = logging.getLogger(__name__)


class ProjectLabPlugin(BasePlugin):
    """Cross-discipline project & experiment version management."""

    name = "project-lab"
    version = "1.0.0"

    async def on_load(self, bus, config) -> None:
        """Routes are registered by the engine via get_routes()."""
        logger.info("Project Lab plugin loaded")

    async def on_unload(self) -> None:
        logger.info("Project Lab plugin unloaded")

    def get_routes(self) -> APIRouter:
        """Return the FastAPI router for this plugin."""
        from backend.plugins.project_lab.routes import router

        return router


Plugin = ProjectLabPlugin
