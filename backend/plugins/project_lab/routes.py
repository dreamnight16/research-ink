"""Project Lab API routes — project & experiment CRUD with auto-versioning."""
import json
import uuid
from datetime import UTC, datetime

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
    title: str | None = None
    discipline: str | None = None
    description: str | None = None
    tags: list[str] | None = None


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
    title: str | None = None
    method: str | None = None
    params: dict | None = None
    result: str | None = None
    conclusion: str | None = None
    attachments: list[str] | None = None


class CheckpointCreate(BaseModel):
    entity_type: str = Field(..., pattern=r"^(project|experiment)$")
    entity_id: str
    label: str = Field(..., min_length=1, max_length=100)


# ── Helpers ───────────────────────────────────────────────

def _now() -> str:
    return datetime.now(UTC).isoformat()


def _uid() -> str:
    return str(uuid.uuid4())


async def _record_version(
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
    status: str | None = Query(
        None, pattern=r"^(active|paused|completed|archived)$",
    ),
    tag: str | None = None,
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


# ── Experiment Endpoints ─────────────────────────────────

@router.post("/projects/{project_id}/experiments")
async def create_experiment(project_id: str, body: ExperimentCreate, request: Request):
    """Create an experiment under a project. Records initial version."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query("SELECT id FROM projects WHERE id = ?", (project_id,))
    if not rows:
        raise HTTPException(404, "Project not found")

    eid = _uid()
    ts = _now()
    params_json = json.dumps(body.params, ensure_ascii=False)
    attachments_json = json.dumps(body.attachments, ensure_ascii=False)

    order_rows = storage.sql_query(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order "
        "FROM experiments WHERE project_id = ?",
        (project_id,),
    )
    next_order = order_rows[0]["next_order"]

    storage.sql_execute(
        """INSERT INTO experiments (id, project_id, title, method, params,
           result, conclusion, attachments, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (eid, project_id, body.title, body.method, params_json,
         body.result, body.conclusion, attachments_json, next_order, ts, ts),
    )

    experiment = _experiment_row_to_dict(
        storage.sql_query("SELECT * FROM experiments WHERE id = ?", (eid,))[0]
    )
    await _record_version(
        "experiment", eid, experiment,
        change_summary="Initial version",
        storage=storage, bus=bus,
    )
    await bus.emit("experiment.created", experiment)
    return {"success": True, "data": experiment}


@router.get("/projects/{project_id}/experiments")
async def list_experiments(project_id: str, request: Request):
    """List all experiments for a project."""
    storage = request.app.state.storage
    rows = storage.sql_query(
        "SELECT * FROM experiments WHERE project_id = ? ORDER BY sort_order ASC",
        (project_id,),
    )
    return {"success": True, "data": [_experiment_row_to_dict(r) for r in rows]}


@router.put("/projects/{project_id}/experiments/{experiment_id}")
async def update_experiment(
    project_id: str, experiment_id: str, body: ExperimentUpdate, request: Request,
):
    """Update experiment fields. Records a version."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query("SELECT * FROM experiments WHERE id = ?", (experiment_id,))
    if not rows:
        raise HTTPException(404, "Experiment not found")

    current = _experiment_row_to_dict(rows[0])
    updates: dict[str, object] = {}
    changed: list[str] = []

    field_map = {
        "title": ("title", lambda v: v),
        "method": ("method", lambda v: v),
        "params": ("params", lambda v: json.dumps(v, ensure_ascii=False)),
        "result": ("result", lambda v: v),
        "conclusion": ("conclusion", lambda v: v),
        "attachments": ("attachments", lambda v: json.dumps(v, ensure_ascii=False)),
    }

    for field, (col, transform) in field_map.items():
        new_val = getattr(body, field)
        if new_val is not None:
            transformed = transform(new_val)
            current_val = current[field]
            if isinstance(current_val, (dict, list)):
                current_val = json.dumps(current_val, ensure_ascii=False)
            if transformed != current_val:
                updates[col] = transformed
                changed.append(field)

    if not updates:
        return {"success": True, "data": current}

    updates["updated_at"] = _now()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values: list[object] = list(updates.values()) + [experiment_id]

    storage.sql_execute(
        f"UPDATE experiments SET {set_clause} WHERE id = ?", tuple(values),
    )

    updated = _experiment_row_to_dict(
        storage.sql_query("SELECT * FROM experiments WHERE id = ?", (experiment_id,))[0]
    )
    await _record_version(
        "experiment", experiment_id, updated,
        change_summary=f"Updated {', '.join(changed)}",
        storage=storage, bus=bus,
    )
    await bus.emit("experiment.updated", updated)
    return {"success": True, "data": updated}


@router.patch("/projects/{project_id}/experiments/{experiment_id}/status")
async def update_experiment_status(
    project_id: str, experiment_id: str, body: StatusUpdate, request: Request,
):
    """Quick experiment status change. Records a version."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query("SELECT id FROM experiments WHERE id = ?", (experiment_id,))
    if not rows:
        raise HTTPException(404, "Experiment not found")

    ts = _now()
    storage.sql_execute(
        "UPDATE experiments SET status = ?, updated_at = ? WHERE id = ?",
        (body.status, ts, experiment_id),
    )
    updated = _experiment_row_to_dict(
        storage.sql_query("SELECT * FROM experiments WHERE id = ?", (experiment_id,))[0]
    )
    await _record_version(
        "experiment", experiment_id, updated,
        change_summary=f"Status → {body.status}",
        storage=storage, bus=bus,
    )
    await bus.emit("experiment.updated", updated)
    return {"success": True, "data": updated}


@router.delete("/projects/{project_id}/experiments/{experiment_id}")
async def delete_experiment(project_id: str, experiment_id: str, request: Request):
    """Delete an experiment and its versions."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query("SELECT id FROM experiments WHERE id = ?", (experiment_id,))
    if not rows:
        raise HTTPException(404, "Experiment not found")

    storage.sql_execute(
        "DELETE FROM versions WHERE entity_type='experiment' AND entity_id = ?",
        (experiment_id,),
    )
    storage.sql_execute("DELETE FROM experiments WHERE id = ?", (experiment_id,))
    await bus.emit("experiment.deleted", {"id": experiment_id, "project_id": project_id})
    return {"success": True, "data": None}


# ── Version Endpoints ────────────────────────────────────

@router.get("/versions")
async def list_versions(
    request: Request,
    entity_type: str = Query(..., pattern=r"^(project|experiment)$"),
    entity_id: str = Query(...),
):
    """Get version history for an entity (newest first)."""
    storage = request.app.state.storage
    rows = storage.sql_query(
        """SELECT id, entity_type, entity_id, snapshot, change_summary,
           is_checkpoint, label, created_at
           FROM versions
           WHERE entity_type = ? AND entity_id = ?
           ORDER BY created_at DESC""",
        (entity_type, entity_id),
    )
    versions = []
    for r in rows:
        versions.append({
            "id": r["id"],
            "entity_type": r["entity_type"],
            "entity_id": r["entity_id"],
            "snapshot": json.loads(r["snapshot"]) if r["snapshot"] else {},
            "change_summary": r["change_summary"],
            "is_checkpoint": bool(r["is_checkpoint"]),
            "label": r["label"],
            "created_at": r["created_at"],
        })
    return {"success": True, "data": versions}


@router.post("/versions")
async def create_checkpoint(body: CheckpointCreate, request: Request):
    """Create a manual checkpoint (snapshot) for a project or experiment."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    table = body.entity_type + "s"  # "projects" or "experiments"
    rows = storage.sql_query(f"SELECT * FROM {table} WHERE id = ?", (body.entity_id,))
    if not rows:
        raise HTTPException(404, f"{body.entity_type.capitalize()} not found")

    converter = _project_row_to_dict if body.entity_type == "project" else _experiment_row_to_dict
    entity = converter(rows[0])

    vid = await _record_version(
        body.entity_type, body.entity_id, entity,
        is_checkpoint=True, label=body.label,
        change_summary=f"Checkpoint: {body.label}",
        storage=storage, bus=bus,
    )
    return {"success": True, "data": {"id": vid, "label": body.label}}


@router.get("/versions/{version_id}")
async def get_version(version_id: str, request: Request):
    """Get a specific version's full snapshot."""
    storage = request.app.state.storage
    rows = storage.sql_query(
        "SELECT * FROM versions WHERE id = ?", (version_id,),
    )
    if not rows:
        raise HTTPException(404, "Version not found")

    r = rows[0]
    return {
        "success": True,
        "data": {
            "id": r["id"],
            "entity_type": r["entity_type"],
            "entity_id": r["entity_id"],
            "snapshot": json.loads(r["snapshot"]) if r["snapshot"] else {},
            "change_summary": r["change_summary"],
            "is_checkpoint": bool(r["is_checkpoint"]),
            "label": r["label"],
            "created_at": r["created_at"],
        },
    }


@router.post("/versions/{version_id}/rollback")
async def rollback_version(version_id: str, request: Request):
    """Rollback an entity to a specific version. Creates a new version recording the rollback."""
    storage = request.app.state.storage
    bus = request.app.state.bus

    rows = storage.sql_query(
        "SELECT * FROM versions WHERE id = ?", (version_id,),
    )
    if not rows:
        raise HTTPException(404, "Version not found")

    r = rows[0]
    entity_type = r["entity_type"]
    entity_id = r["entity_id"]
    snapshot = json.loads(r["snapshot"])

    ts = _now()

    if entity_type == "project":
        storage.sql_execute(
            """UPDATE projects SET title=?, discipline=?, description=?,
               tags=?, updated_at=? WHERE id=?""",
            (snapshot["title"], snapshot.get("discipline", ""),
             snapshot.get("description", ""),
             json.dumps(snapshot.get("tags", []), ensure_ascii=False),
             ts, entity_id),
        )
    else:
        storage.sql_execute(
            """UPDATE experiments SET title=?, method=?, params=?,
               result=?, conclusion=?, attachments=?, updated_at=? WHERE id=?""",
            (snapshot["title"], snapshot.get("method", ""),
             json.dumps(snapshot.get("params", {}), ensure_ascii=False),
             snapshot.get("result", ""), snapshot.get("conclusion", ""),
             json.dumps(snapshot.get("attachments", []), ensure_ascii=False),
             ts, entity_id),
        )

    rollback_label = r["label"] if r["label"] else version_id[:8]
    await _record_version(
        entity_type, entity_id, snapshot,
        change_summary=f"Rolled back to {rollback_label}",
        is_checkpoint=False,
        storage=storage, bus=bus,
    )
    await bus.emit("version.rollback", {
        "entity_type": entity_type, "entity_id": entity_id,
        "version_id": version_id,
    })
    return {"success": True, "data": {"message": f"Rolled back to {rollback_label}"}}
