# backend/main.py
from pathlib import Path

import uvicorn

from backend.api.gateway import create_app
from backend.core.config import Config


def main():
    import os
    data_dir = str(Path.home() / ".research-ink")
    config = Config.load(data_dir)
    app = create_app(config)
    # Default to loopback; set YANMO_HOST=0.0.0.0 only to enable LAN pairing.
    host = os.environ.get("YANMO_HOST", "127.0.0.1")
    port = int(os.environ.get("YANMO_PORT", "8000"))
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
