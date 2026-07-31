"""Project Lab API routes — project & experiment CRUD with auto-versioning."""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/project-lab", tags=["project-lab"])


# ── Schemas ──────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    discipline: str = ""
    description: str = ""
    tags: list[str] = []


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    discipline: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None


class StatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(active|paused|completed|archived)$")


class ExperimentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    method: str = ""
    params: dict = {}
    result: str = ""
    conclusion: str = ""
    attachments: list[str] = []


class ExperimentUpdate(BaseModel):
    title: Optional[str] = None
    method: Optional[str] = None
    params: Optional[dict] = None
    result: Optional[str] = None
    conclusion: Optional[str] = None
    attachments: Optional[list[str]] = None


class CheckpointCreate(BaseModel):
    entity_type: str = Field(..., pattern=r"^(project|experiment)$")
    entity_id: str
    label: str = Field(..., min_length=1, max_length=100)


# ── Helpers ───────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return str(uuid.uuid4())


def _record_version(
    entity_type: str,
    entity_id: str,
    snapshot: dict,
    *,
    is_checkpoint: bool = False,
    label: str = "",
    change_summary: str = "",
    storage,
    bus,
) -> str:
    """Create a version record, publish event, and return its ID."""
    vid = _uid()
    storage.sql_execute(
        """INSERT INTO versions (id, entity_type, entity_id, snapshot,
           change_summary, is_checkpoint, label, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            vid, entity_type, entity_id,
            json.dumps(snapshot, ensure_ascii=False),
            change_summary, int(is_checkpoint), label, _now(),
        ),
    )
    await bus.emit("version.created", {
        "id": vid, "entity_type": entity_type, "entity_id": entity_id,
        "is_checkpoint": is_checkpoint, "label": label,
    })
    return vid


def _project_row_to_dict(row: dict) -> dict:
    """Convert a projects table row dict to a response dict.

    Note: storage.sql_query() returns list[dict] with string keys,
    not positional tuples. JSON fields are deserialised.
    """
    return {
        "id": row["id"],
        "title": row["title"],
        "discipline": row["discipline"],
        "description": row["description"],
        "status": row["status"],
        "tags": json.loads(row["tags"]) if row["tags"] else [],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _experiment_row_to_dict(row: dict) -> dict:
    """Convert an experiments table row dict to a response dict."""
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "title": row["title"],
        "method": row["method"],
        "params": json.loads(row["params"]) if row["params"] else {},
        "result": row["result"],
        "conclusion": row["conclusion"],
        "attachments": json.loads(row["attachments"]) if row["attachments"] else [],
        "status": row["status"],
        "sort_order": row["sort_order"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# ── Project Endpoints ────────────────────────────────────

@router.post("/projects")
async def create_project(body: ProjectCreate, request: Request):
    """Create a new research project."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    pid = _uid()
    ts = _now()
    tags_json = json.dumps(body.tags, ensure_ascii=False)

    storage.sql_execute(
        """INSERT INTO projects (id, title, discipline, description,
           tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (pid, body.title, body.discipline, body.description, tags_json, ts, ts),
    )

    rows = storage.sql_query("SELECT * FROM projects WHERE id = ?", (pid,))
    project = _project_row_to_dict(rows[0])
    await _record_version(
        "project", pid, project,
        change_summary="Initial version",
        storage=storage, bus=bus,
    )
    await bus.emit("project.created", project)
    return {"success": True, "data": project}


@router.get("/projects")
async def list_projects(
    request: Request,
    status: Optional[str] = Query(
        None, pattern=r"^(active|paused|completed|archived)$",
    ),
    tag: Optional[str] = None,
):
    """List all projects, optionally filtered by status or tag."""
    storage = request.app.state.storage

    rows = storage.sql_query("SELECT * FROM projects ORDER BY updated_at DESC")
    projects = [_project_row_to_dict(r) for r in rows]

    if status:
        projects = [p for p in projects if p["status"] == status]
    if tag:
        projects = [p for p in projects if tag in p["tags"]]

    return {"success": True, "data": projects}


@router.get("/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    """Get a project with its experiments."""
    storage = request.app.state.storage

    rows = storage.sql_query("SELECT * FROM projects WHERE id = ?", (project_id,))
    if not rows:
        raise HTTPException(404, "Project not found")

    project = _project_row_to_dict(rows[0])
    exp_rows = storage.sql_query(
        "SELECT * FROM experiments WHERE project_id = ? ORDER BY sort_order ASC",
        (project_id,),
    )
    project["experiments"] = [_experiment_row_to_dict(r) for r in exp_rows]
    return {"success": True, "data": project}


@router.put("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, request: Request):
    """Update project fields. Automatically records a version."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query("SELECT * FROM projects WHERE id = ?", (project_id,))
    if not rows:
        raise HTTPException(404, "Project not found")

    current = _project_row_to_dict(rows[0])
    updates: dict[str, object] = {}
    changed: list[str] = []

    if body.title is not None and body.title != current["title"]:
        updates["title"] = body.title
        changed.append("title")
    if body.discipline is not None and body.discipline != current["discipline"]:
        updates["discipline"] = body.discipline
        changed.append("discipline")
    if body.description is not None and body.description != current["description"]:
        updates["description"] = body.description
        changed.append("description")
    if body.tags is not None:
        new_tags = json.dumps(body.tags, ensure_ascii=False)
        if new_tags != json.dumps(current["tags"], ensure_ascii=False):
            updates["tags"] = new_tags
            changed.append("tags")

    if not updates:
        return {"success": True, "data": current}

    updates["updated_at"] = _now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values: list[object] = list(updates.values()) + [project_id]

    storage.sql_execute(
        f"UPDATE projects SET {set_clause} WHERE id = ?",
        tuple(values),
    )

    updated_rows = storage.sql_query(
        "SELECT * FROM projects WHERE id = ?", (project_id,),
    )
    updated = _project_row_to_dict(updated_rows[0])
    summary = f"Updated {', '.join(changed)}"
    await _record_version(
        "project", project_id, updated,
        change_summary=summary, storage=storage, bus=bus,
    )
    await bus.emit("project.updated", updated)
    return {"success": True, "data": updated}


@router.patch("/projects/{project_id}/status")
async def update_project_status(
    project_id: str, body: StatusUpdate, request: Request,
):
    """Quick status change. Records a version."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query("SELECT * FROM projects WHERE id = ?", (project_id,))
    if not rows:
        raise HTTPException(404, "Project not found")

    ts = _now()
    storage.sql_execute(
        "UPDATE projects SET status = ?, updated_at = ? WHERE id = ?",
        (body.status, ts, project_id),
    )
    updated_rows = storage.sql_query(
        "SELECT * FROM projects WHERE id = ?", (project_id,),
    )
    updated = _project_row_to_dict(updated_rows[0])
    await _record_version(
        "project", project_id, updated,
        change_summary=f"Status → {body.status}",
        storage=storage, bus=bus,
    )
    await bus.emit("project.updated", updated)
    return {"success": True, "data": updated}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    """Delete a project and all its experiments and versions (CASCADE)."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query("SELECT id FROM projects WHERE id = ?", (project_id,))
    if not rows:
        raise HTTPException(404, "Project not found")

    # Delete versions for this project and its experiments
    storage.sql_execute(
        "DELETE FROM versions WHERE entity_id IN "
        "(SELECT id FROM experiments WHERE project_id = ?) "
        "OR (entity_type = 'project' AND entity_id = ?)",
        (project_id, project_id),
    )
    storage.sql_execute("DELETE FROM projects WHERE id = ?", (project_id,))
    await bus.emit("project.deleted", {"id": project_id})
    return {"success": True, "data": None}
