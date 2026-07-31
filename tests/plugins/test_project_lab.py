"""Tests for project-lab plugin — schema and CRUD operations."""
import json
import uuid
from datetime import datetime, timezone

import pytest


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TestSchema:
    """Verify project-lab tables exist and are queryable."""

    def test_projects_table_exists(self, storage):
        """Projects table should exist after schema init."""
        rows = storage.sql_query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
        )
        assert len(rows) == 1

    def test_experiments_table_exists(self, storage):
        rows = storage.sql_query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='experiments'"
        )
        assert len(rows) == 1

    def test_versions_table_exists(self, storage):
        rows = storage.sql_query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='versions'"
        )
        assert len(rows) == 1

    def test_versions_index_exists(self, storage):
        rows = storage.sql_query(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_versions_entity'"
        )
        assert len(rows) == 1

    def test_experiments_fk_cascade(self, storage):
        """Deleting a project cascades to its experiments."""
        pid = str(uuid.uuid4())
        eid = str(uuid.uuid4())
        ts = now_iso()
        storage.sql_execute(
            "INSERT INTO projects(id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (pid, "Test Project", ts, ts),
        )
        storage.sql_execute(
            "INSERT INTO experiments(id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (eid, pid, "Test Experiment", ts, ts),
        )
        storage.sql_execute("DELETE FROM projects WHERE id = ?", (pid,))
        rows = storage.sql_query(
            "SELECT id FROM experiments WHERE id = ?", (eid,)
        )
        assert len(rows) == 0
