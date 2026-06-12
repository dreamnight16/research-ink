import importlib.util
import logging
import os
import tomllib
from pathlib import Path
from typing import Any

from backend.core.event_bus import EventBus

logger = logging.getLogger(__name__)


class PluginEngine:
    def __init__(self, bus: EventBus, config: dict[str, Any]):
        self._bus = bus
        self._config = config
        self._plugins: dict[str, Any] = {}
        self._plugin_dirs: list[str] = []
        self._user_plugins_dir: str = ""

    def set_user_plugins_dir(self, path: str) -> None:
        os.makedirs(path, exist_ok=True)
        self._user_plugins_dir = path

    def discover_plugins(self, plugins_dir: str) -> list[dict[str, Any]]:
        manifests = []
        base = Path(plugins_dir)
        if not base.exists():
            return manifests
        for candidate in base.iterdir():
            if not candidate.is_dir():
                continue
            manifest_path = candidate / "plugin.toml"
            if not manifest_path.exists():
                continue
            try:
                raw = tomllib.loads(manifest_path.read_text())
            except Exception:
                logger.warning("Failed to parse plugin manifest: %s", manifest_path, exc_info=True)
                continue
            p = raw.get("plugin", {})
            deps = p.get("dependencies", [])
            manifests.append({
                "name": p.get("name", candidate.name),
                "display_name": p.get("display_name", candidate.name),
                "version": p.get("version", "0.0.0"),
                "description": p.get("description", ""),
                "author": p.get("author", ""),
                "dependencies": deps if isinstance(deps, list) else [],
                "path": str(candidate),
                "source": "builtin" if str(base) in str(Path(__file__).parent.parent / "plugins") else "user",
            })
        return manifests

    def discover_all(self) -> list[dict[str, Any]]:
        """Discover from all registered plugin directories."""
        manifests: list[dict[str, Any]] = []
        for d in self._plugin_dirs:
            manifests.extend(self.discover_plugins(d))
        return manifests

    def _is_user_plugin(self, plugin_path: str) -> bool:
        """Check if a plugin path is from the user plugins directory (untrusted)."""
        if not self._user_plugins_dir:
            return False
        return os.path.abspath(plugin_path).startswith(os.path.abspath(self._user_plugins_dir))

    async def load_plugin_from_path(self, plugin_path: str, plugin_name: str) -> bool:
        """Load a plugin from its directory path. Returns True on success."""
        plugin_file = os.path.join(plugin_path, "plugin.py")
        if not os.path.exists(plugin_file):
            logger.warning("No plugin.py found at %s", plugin_path)
            return False

        # Validate plugin dependencies
        manifest_path = os.path.join(plugin_path, "plugin.toml")
        if os.path.exists(manifest_path):
            try:
                raw = tomllib.loads(Path(manifest_path).read_text())
                deps = raw.get("plugin", {}).get("dependencies", [])
                if isinstance(deps, list):
                    loaded = set(self._plugins.keys())
                    missing = [d for d in deps if d not in loaded]
                    if missing:
                        logger.warning(
                            "Plugin '%s' depends on %s which are not loaded — skipping",
                            plugin_name, missing,
                        )
                        return False
            except Exception:
                pass

        # Security gate: user plugins run in-process and can access the filesystem,
        # network, and sensitive config files like .api_token.
        # WARNING: There is NO sandboxing — plugins execute arbitrary Python in the same
        # process with full user permissions. For production, consider subprocess isolation
        # (e.g., multiprocessing + restricted file descriptors) or container-based sandboxing.
        if self._is_user_plugin(plugin_path):
            if not self._config.get("allow_untrusted_plugins", False):
                logger.warning(
                    "Refusing to load user plugin '%s' from %s — third-party plugins "
                    "run in-process and can read files (including .api_token), access the "
                    "network, and execute arbitrary code. Set 'allow_untrusted_plugins: true' "
                    "in config.json to enable. Only enable if you have reviewed the plugin source code.",
                    plugin_name, plugin_path,
                )
                return False
            logger.warning(
                "CRITICAL: Loading untrusted plugin '%s' from %s. The plugin has full access "
                "to the filesystem, network, and credentials. NO sandboxing is applied. "
                "Ensure you have audited the plugin source code.",
                plugin_name, plugin_path,
            )

        try:
            # 插件在进程内运行，可访问 os/subprocess/socket
            spec = importlib.util.spec_from_file_location(
                f"plugins.{plugin_name}", plugin_file
            )
            if not spec or not spec.loader:
                return False
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            plugin_instance = module.Plugin()
            await self.load_plugin(plugin_name, plugin_instance)
            logger.info("Plugin loaded: %s from %s", plugin_name, plugin_path)
            return True
        except Exception:
            logger.exception("Failed to load plugin %s from %s", plugin_name, plugin_path)
            return False

    async def load_plugin(self, name: str, plugin: Any) -> None:
        await plugin.on_load(self._bus, self._config)
        self._plugins[name] = plugin

    async def unload_plugin(self, name: str) -> None:
        if name in self._plugins:
            await self._plugins[name].on_unload()
            del self._plugins[name]

    def list_plugins(self) -> dict[str, Any]:
        return dict(self._plugins)

    def get_plugin_info(self, name: str) -> dict[str, Any] | None:
        plugin = self._plugins.get(name)
        if not plugin:
            return None
        return {
            "name": getattr(plugin, "name", name),
            "display_name": getattr(plugin, "display_name", name),
            "version": getattr(plugin, "version", "0.0.0"),
        }

    async def shutdown(self) -> None:
        for name in list(self._plugins):
            await self.unload_plugin(name)
