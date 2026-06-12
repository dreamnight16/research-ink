from backend.core.schema import ensure_schema, SCHEMA_DDL


class TestSchema:
    def test_all_ddl_is_non_empty(self):
        assert len(SCHEMA_DDL) >= 4
        for ddl in SCHEMA_DDL:
            assert "CREATE TABLE" in ddl

    def test_ensure_schema_is_idempotent(self, storage):
        ensure_schema(storage)
        ensure_schema(storage)
        rows = storage.sql_query(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        table_names = {r["name"] for r in rows}
        assert "kv" in table_names
        assert "classifications" in table_names
        assert "cloud_approvals" in table_names
        assert "audit_log" in table_names

    def test_kv_table_accepts_insert(self, storage):
        ensure_schema(storage)
        storage.sql_execute(
            "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
            ("test", '{"a": 1}'),
        )
        rows = storage.sql_query("SELECT value FROM kv WHERE key = 'test'")
        assert len(rows) == 1
