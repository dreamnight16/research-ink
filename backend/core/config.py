import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_KEYRING_SERVICE = "com.researchink.research-assistant"


def _load_cloud_api_key() -> str:
    """从系统 keyring 加载 cloud_api_key，失败则回退到环境变量。"""
    try:
        import keyring
        key = keyring.get_password(_KEYRING_SERVICE, "cloud_api_key")
        if key:
            return key
    except ImportError:
        logger.debug("keyring 未安装 — 如需安全存储 API 密钥，请: pip install keyring")
    except Exception as e:
        logger.debug("keyring 读取失败: %s", e)
    return ""


def _save_cloud_api_key(key: str) -> None:
    """将 cloud_api_key 存储到系统 keyring。"""
    if not key:
        return
    try:
        import keyring
        keyring.set_password(_KEYRING_SERVICE, "cloud_api_key", key)
        logger.info("cloud_api_key 已存储到系统 keyring")
    except ImportError:
        pass
    except Exception as e:
        logger.warning("keyring 存储失败: %s", e)


@dataclass
class Config:
    llm_provider: str = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:14b"
    cloud_api_key: str = ""
    cloud_provider: str = ""
    cloud_model: str = ""
    default_classification: str = "cautious"
    data_dir: str = field(default_factory=lambda: str(Path.home() / ".research-ink"))
    allow_untrusted_plugins: bool = False

    _SENSITIVE = {"cloud_api_key"}

    @classmethod
    def load(cls, data_dir: str) -> "Config":
        config_path = Path(data_dir) / "config.json"
        if config_path.exists():
            try:
                with open(config_path) as f:
                    raw = json.load(f)
                if not isinstance(raw, dict):
                    raise ValueError("config.json is not a JSON object")
                cfg = cls(**{k: v for k, v in raw.items() if k in cls.__dataclass_fields__})
            except (json.JSONDecodeError, ValueError, TypeError) as e:
                logger.warning("config.json is corrupted (%s), using defaults", e)
                broken_path = config_path.with_suffix(".json.broken")
                try:
                    config_path.rename(broken_path)
                    logger.info("Corrupted config backed up to %s", broken_path)
                except OSError:
                    pass
                cfg = cls()
            else:
                # 优先从 keyring 加载 API 密钥（而非 config.json 明文）
                keyring_key = _load_cloud_api_key()
                if keyring_key:
                    cfg.cloud_api_key = keyring_key
                elif cfg.cloud_api_key:
                    # 从旧 config.json 迁移到 keyring
                    logger.info("正在将 cloud_api_key 从 config.json 迁移到系统 keyring...")
                    _save_cloud_api_key(cfg.cloud_api_key)
                    cfg.cloud_api_key = ""
                    cfg.save()
                return cfg
        cfg = cls()
        cfg.data_dir = data_dir
        return cfg

    def save(self) -> None:
        path = Path(self.data_dir)
        path.mkdir(parents=True, exist_ok=True)
        # 尝试将 API 密钥存储到 keyring
        if self.cloud_api_key:
            _save_cloud_api_key(self.cloud_api_key)
        raw = asdict(self)
        # 从磁盘文件中剥离敏感字段
        for key in self._SENSITIVE:
            raw.pop(key, None)
        with open(path / "config.json", "w") as f:
            json.dump(raw, f, indent=2)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for key in self._SENSITIVE:
            d.pop(key, None)
        return d
