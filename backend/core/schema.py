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
    # --- Project Lab tables ---
    """CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        discipline  TEXT DEFAULT '',
        description TEXT DEFAULT '',
        status      TEXT DEFAULT 'active',
        tags        TEXT DEFAULT '[]',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS experiments (
        id          TEXT PRIMARY KEY,
        project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        method      TEXT DEFAULT '',
        params      TEXT DEFAULT '{}',
        result      TEXT DEFAULT '',
        conclusion  TEXT DEFAULT '',
        attachments TEXT DEFAULT '[]',
        status      TEXT DEFAULT 'draft',
        sort_order  INTEGER DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS versions (
        id              TEXT PRIMARY KEY,
        entity_type     TEXT NOT NULL,
        entity_id       TEXT NOT NULL,
        snapshot        TEXT NOT NULL,
        change_summary  TEXT DEFAULT '',
        is_checkpoint   INTEGER DEFAULT 0,
        label           TEXT DEFAULT '',
        created_at      TEXT NOT NULL
    )""",
    """CREATE INDEX IF NOT EXISTS idx_versions_entity
    ON versions(entity_type, entity_id, created_at DESC)""",
]


def ensure_schema(storage) -> None:
    for ddl in SCHEMA_DDL:
        storage.sql_execute(ddl)
