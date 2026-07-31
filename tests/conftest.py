import tempfile
import pytest
from backend.core.schema import ensure_schema
from backend.core.storage import Storage
from backend.core.security import SecurityManager
from backend.core.event_bus import EventBus
from backend.core.config import Config


@pytest.fixture
def tmp_data_dir():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
        yield d


@pytest.fixture
def storage(tmp_data_dir):
    s = Storage(tmp_data_dir)
    ensure_schema(s)
    yield s
    s.close()


@pytest.fixture
def security_manager(storage):
    return SecurityManager(storage=storage)


@pytest.fixture
def event_bus():
    return EventBus()


@pytest.fixture
def config(tmp_data_dir):
    cfg = Config()
    cfg.data_dir = tmp_data_dir
    return cfg
