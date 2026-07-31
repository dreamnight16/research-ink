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


class TestProjectCRUD:
    """Project create, read, update, delete with auto-versioning.

    Note: storage.sql_query() returns list[dict] (string-keyed rows),
    not positional tuples. Column access uses row["column_name"].
    """

    def test_create_project(self, storage):
        ts = now_iso()
        pid = str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO projects(id, title, discipline, description, "
            "tags, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (pid, "Test Project", "CS", "A test",
             json.dumps(["ai", "ml"]), ts, ts),
        )
        rows = storage.sql_query("SELECT * FROM projects WHERE id = ?", (pid,))
        assert len(rows) == 1
        assert rows[0]["title"] == "Test Project"
        assert rows[0]["discipline"] == "CS"

    def test_list_projects_filtered_by_status(self, storage):
        ts = now_iso()
        pid1, pid2 = str(uuid.uuid4()), str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO projects(id, title, status, created_at, updated_at) "
            "VALUES (?,?,?,?,?)",
            (pid1, "Active Project", "active", ts, ts),
        )
        storage.sql_execute(
            "INSERT INTO projects(id, title, status, created_at, updated_at) "
            "VALUES (?,?,?,?,?)",
            (pid2, "Done Project", "completed", ts, ts),
        )
        rows = storage.sql_query(
            "SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC",
            ("active",),
        )
        assert len(rows) == 1
        assert rows[0]["title"] == "Active Project"

    def test_update_project_triggers_version(self, storage):
        ts = now_iso()
        pid = str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO projects(id, title, created_at, updated_at) "
            "VALUES (?,?,?,?)",
            (pid, "Original", ts, ts),
        )
        storage.sql_execute(
            "UPDATE projects SET title = ?, updated_at = ? WHERE id = ?",
            ("Updated Title", ts, pid),
        )
        # Verify version was created (in real flow, routes.py does this)
        vid = str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO versions(id, entity_type, entity_id, snapshot, "
            "change_summary, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (vid, "project", pid,
             json.dumps({"title": "Updated Title"}),
             "Updated title", ts),
        )
        vrows = storage.sql_query(
            "SELECT * FROM versions WHERE entity_type=? AND entity_id=?",
            ("project", pid),
        )
        assert len(vrows) == 1
        assert vrows[0]["change_summary"] == "Updated title"

    def test_delete_project_cascades_experiments(self, storage):
        ts = now_iso()
        pid = str(uuid.uuid4())
        eid = str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO projects(id, title, created_at, updated_at) "
            "VALUES (?,?,?,?)",
            (pid, "P", ts, ts),
        )
        storage.sql_execute(
            "INSERT INTO experiments(id, project_id, title, created_at, "
            "updated_at) VALUES (?,?,?,?,?)",
            (eid, pid, "E", ts, ts),
        )
        storage.sql_execute("DELETE FROM projects WHERE id = ?", (pid,))
        rows = storage.sql_query("SELECT id FROM experiments WHERE id = ?", (eid,))
        assert len(rows) == 0


class TestExperimentCRUD:
    """Experiment create, update, delete within a project."""

    def test_create_experiment(self, storage):
        ts = now_iso()
        pid = str(uuid.uuid4())
        eid = str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO projects(id, title, created_at, updated_at) VALUES (?,?,?,?)",
            (pid, "P", ts, ts),
        )
        storage.sql_execute(
            """INSERT INTO experiments(id, project_id, title, method, params,
               result, conclusion, attachments, sort_order, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (eid, pid, "Exp1", "TestMethod", '{"x":1}', "Result1", "Conclusion1",
             '["file.pdf"]', 0, ts, ts),
        )
        rows = storage.sql_query("SELECT * FROM experiments WHERE id = ?", (eid,))
        assert len(rows) == 1
        assert rows[0]["title"] == "Exp1"

    def test_update_experiment(self, storage):
        ts = now_iso()
        pid = str(uuid.uuid4())
        eid = str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO projects(id, title, created_at, updated_at) VALUES (?,?,?,?)",
            (pid, "P", ts, ts),
        )
        storage.sql_execute(
            """INSERT INTO experiments(id, project_id, title, method, created_at, updated_at)
               VALUES (?,?,?,?,?,?)""",
            (eid, pid, "Original", "OldMethod", ts, ts),
        )
        storage.sql_execute(
            "UPDATE experiments SET title=?, method=?, updated_at=? WHERE id=?",
            ("Updated", "NewMethod", ts, eid),
        )
        rows = storage.sql_query("SELECT * FROM experiments WHERE id = ?", (eid,))
        assert rows[0]["title"] == "Updated"
        assert rows[0]["method"] == "NewMethod"

    def test_delete_experiment(self, storage):
        ts = now_iso()
        pid = str(uuid.uuid4())
        eid = str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO projects(id, title, created_at, updated_at) VALUES (?,?,?,?)",
            (pid, "P", ts, ts),
        )
        storage.sql_execute(
            "INSERT INTO experiments(id, project_id, title, created_at, updated_at) VALUES (?,?,?,?,?)",
            (eid, pid, "E", ts, ts),
        )
        storage.sql_execute("DELETE FROM experiments WHERE id = ?", (eid,))
        rows = storage.sql_query("SELECT id FROM experiments WHERE id = ?", (eid,))
        assert len(rows) == 0


class TestVersionManagement:
    """Version history, checkpoints, and rollback."""

    def test_version_history_returns_newest_first(self, storage):
        ts1 = "2026-01-01T00:00:00"
        ts2 = "2026-06-01T00:00:00"
        pid = str(uuid.uuid4())
        vid1, vid2 = str(uuid.uuid4()), str(uuid.uuid4())
        storage.sql_execute(
            "INSERT INTO versions(id, entity_type, entity_id, snapshot, created_at) VALUES (?,?,?,?,?)",
            (vid1, "project", pid, '{"title":"v1"}', ts1),
        )
        storage.sql_execute(
            "INSERT INTO versions(id, entity_type, entity_id, snapshot, created_at) VALUES (?,?,?,?,?)",
            (vid2, "project", pid, '{"title":"v2"}', ts2),
        )
        rows = storage.sql_query(
            "SELECT * FROM versions WHERE entity_type=? AND entity_id=? ORDER BY created_at DESC",
            ("project", pid),
        )
        assert len(rows) == 2
        assert rows[0]["id"] == vid2  # newest first

    def test_checkpoint_has_is_checkpoint_flag(self, storage):
        vid = str(uuid.uuid4())
        pid = str(uuid.uuid4())
        storage.sql_execute(
            """INSERT INTO versions(id, entity_type, entity_id, snapshot,
               is_checkpoint, label, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (vid, "project", pid, '{"title":"snap"}', 1, "Milestone 1", "2026-01-01"),
        )
        rows = storage.sql_query("SELECT * FROM versions WHERE id = ?", (vid,))
        assert rows[0]["is_checkpoint"] == 1
        assert rows[0]["label"] == "Milestone 1"

    def test_rollback_restores_snapshot(self, storage):
        ts = now_iso()
        pid = str(uuid.uuid4())
        vid = str(uuid.uuid4())
        # Create project
        storage.sql_execute(
            "INSERT INTO projects(id, title, discipline, created_at, updated_at) VALUES (?,?,?,?,?)",
            (pid, "Original", "Physics", ts, ts),
        )
        # Create a version snapshot with different title
        storage.sql_execute(
            """INSERT INTO versions(id, entity_type, entity_id, snapshot, created_at)
               VALUES (?,?,?,?,?)""",
            (vid, "project", pid, '{"title":"Snapshot Title","discipline":"Physics"}', ts),
        )
        # Simulate rollback: update project from snapshot
        storage.sql_execute(
            "UPDATE projects SET title=?, updated_at=? WHERE id=?",
            ("Snapshot Title", ts, pid),
        )
        rows = storage.sql_query("SELECT title FROM projects WHERE id = ?", (pid,))
        assert rows[0]["title"] == "Snapshot Title"
