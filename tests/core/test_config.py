import json
import tempfile
from pathlib import Path
from backend.core.config import Config


def test_config_loads_defaults():
    cfg = Config()
    assert cfg.llm_provider == "ollama"
    assert cfg.ollama_base_url == "http://localhost:11434"
    assert cfg.ollama_model == "qwen3:14b"
    assert cfg.cloud_api_key == ""
    assert cfg.cloud_provider == ""
    assert cfg.cloud_model == ""
    assert cfg.default_classification == "cautious"
    assert cfg.data_dir == str(Path.home() / ".research-ink")


def test_config_save_and_load_from_file():
    with tempfile.TemporaryDirectory() as tmp:
        cfg = Config()
        cfg.ollama_model = "llama3:8b"
        cfg.data_dir = tmp
        cfg.cloud_api_key = "sk-test"
        cfg.cloud_provider = "claude"
        cfg.save()

        cfg2 = Config.load(tmp)
        assert cfg2.ollama_model == "llama3:8b"
        assert cfg2.cloud_api_key == "sk-test"
        assert cfg2.cloud_provider == "claude"


def test_config_to_dict_excludes_sensitive():
    cfg = Config()
    cfg.cloud_api_key = "sk-secret"
    d = cfg.to_dict()
    assert d["cloud_provider"] == ""
    assert "cloud_api_key" not in d
