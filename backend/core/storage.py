import sqlite3
import threading
from pathlib import Path
from typing import Any, cast

import chromadb


class Storage:
    def __init__(self, data_dir: str):
        self._data_dir = Path(data_dir)
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._sqlite_path = str(self._data_dir / "research.db")
        self._local = threading.local()
        self._chroma_client = chromadb.PersistentClient(
            path=str(self._data_dir / "chroma")
        )

    def _get_conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self._sqlite_path)
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA busy_timeout=5000")
            self._local.conn.execute("PRAGMA foreign_keys=ON")
        return cast(sqlite3.Connection, self._local.conn)

    def sql_execute(self, sql: str, params: tuple = ()) -> None:
        conn = self._get_conn()
        conn.execute(sql, params)
        conn.commit()

    def sql_query(self, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
        conn = self._get_conn()
        rows = conn.execute(sql, params).fetchall()
        return [dict(row) for row in rows]

    def chroma_collection(self, name: str) -> Any:
        return self._chroma_client.get_or_create_collection(name=name)

    def close(self) -> None:
        if hasattr(self._local, "conn") and self._local.conn is not None:
            self._local.conn.close()
            self._local.conn = None
        self._chroma_client.clear_system_cache()
        self._chroma_client.close()  # type: ignore[attr-defined]
