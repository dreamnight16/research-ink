# 研墨 Plugin Development Guide

## Quick Start

A plugin is a directory containing:

```
my-plugin/
├── plugin.toml     # Manifest — metadata
├── plugin.py       # Backend — Python Plugin class
└── (optional)      # Frontend components, data, etc.
```

Drop it into `~/.research-ink/plugins/` and load from Settings > Plugins.

## Manifest (plugin.toml)

```toml
[plugin]
name = "my_plugin"
display_name = "My Plugin"
version = "0.1.0"
description = "Short description of what this plugin does"
author = "Your Name"
dependencies = []       # Optional: other plugin names this depends on
```

## Backend (plugin.py)

```python
from fastapi import APIRouter

class Plugin:
    name = "my_plugin"
    display_name = "My Plugin"
    version = "0.1.0"

    async def on_load(self, bus, config):
        """Called when plugin is loaded. Save references."""
        self._bus = bus
        self._config = config

    async def on_unload(self):
        """Called when plugin is unloaded. Clean up resources."""

    def get_routes(self) -> APIRouter | None:
        """Return an APIRouter with your API endpoints, or None."""
        router = APIRouter(prefix="/api/my-plugin", tags=["my-plugin"])

        @router.get("/hello")
        async def hello():
            return {"message": "Hello from my plugin!"}

        return router

    def get_commands(self) -> list[str]:
        """Return list of chat commands this plugin handles."""
        return ["/mycommand"]
```

## Event Bus

Plugins communicate through the event bus. Never import another plugin directly.

```python
# Emit an event
await self._bus.emit("paper.saved", {"arxiv_id": "2301.00001"})

# Listen for events
async def on_paper_saved(self, data):
    print(f"Paper saved: {data['arxiv_id']}")

bus.on("paper.saved", self.on_paper_saved)
```

### Standard Channels

| Channel | Payload | Description |
|---------|---------|-------------|
| `paper.saved` | `{arxiv_id, title}` | A paper was saved to library |
| `paper.updated` | `{arxiv_id}` | Paper metadata was updated |
| `term.added` | `{term, definition}` | New terminology entry |
| `formula.verified` | `{expression, valid}` | Formula verification complete |
| `project.evaluated` | `{title, scores}` | Project evaluation done |

## Accessing Core Services

From `on_load`, you receive `config` (dict). Access core services via FastAPI's `request.app.state` in your routes:

```python
from fastapi import Request

@router.get("/data")
async def get_data(request: Request):
    storage = request.app.state.storage
    security = request.app.state.security
    llm_router = request.app.state.llm_router

    rows = storage.sql_query("SELECT * FROM my_table")
    return {"rows": rows}
```

## Frontend (Optional)

Place a React component file alongside `plugin.py`. Register it in the frontend plugin registry. See existing plugins in `frontend/src/plugins/` for examples.

## Distribution

Share your plugin as a zip file. Users extract it into `~/.research-ink/plugins/<plugin-name>/`.
