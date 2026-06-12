"""Centralized database schema management."""

SCHEMA_DDL = [
    """CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS classifications (
        doc_id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS cloud_approvals (
        doc_id TEXT PRIMARY KEY,
        approved_at TEXT NOT NULL DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id TEXT NOT NULL,
        target_model TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )""",
]


def ensure_schema(storage) -> None:
    for ddl in SCHEMA_DDL:
        storage.sql_execute(ddl)
