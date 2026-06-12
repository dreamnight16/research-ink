from collections import deque
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from backend.core.storage import Storage


class Classification(str, Enum):
    SECRET = "secret"
    CAUTIOUS = "cautious"
    PUBLIC = "public"


MAX_AUDIT_ENTRIES = 10000


class SecurityManager:
    def __init__(self, storage: Storage | None = None) -> None:
        self._storage = storage
        self._classifications: dict[str, Classification] = {}
        self._cloud_approvals: set[str] = set()
        self._audit: deque[dict[str, Any]] = deque(maxlen=MAX_AUDIT_ENTRIES)

    def mark(self, doc_id: str, level: Classification) -> None:
        self._classifications[doc_id] = level
        if self._storage:
            self._storage.sql_execute(
                "INSERT OR REPLACE INTO classifications (doc_id, level, updated_at) "
                "VALUES (?, ?, ?)",
                (doc_id, level.value, datetime.now(UTC).isoformat()),
            )

    def classify_batch(self, mapping: dict[str, Classification]) -> None:
        self._classifications.update(mapping)

    def classification_of(self, doc_id: str) -> Classification:
        if doc_id in self._classifications:
            return self._classifications[doc_id]
        if self._storage:
            rows = self._storage.sql_query(
                "SELECT level FROM classifications WHERE doc_id = ?", (doc_id,)
            )
            if rows:
                level = Classification(rows[0]["level"])
                self._classifications[doc_id] = level
                return level
        return Classification.CAUTIOUS

    def allow_cloud(self, doc_id: str) -> bool:
        level = self.classification_of(doc_id)
        if level == Classification.SECRET:
            return False
        if level == Classification.PUBLIC:
            return True
        if doc_id in self._cloud_approvals:
            return True
        if self._storage:
            rows = self._storage.sql_query(
                "SELECT 1 FROM cloud_approvals WHERE doc_id = ?", (doc_id,)
            )
            if rows:
                self._cloud_approvals.add(doc_id)
                return True
        return False

    def approve_cloud(self, doc_id: str) -> None:
        self._cloud_approvals.add(doc_id)
        if self._storage:
            self._storage.sql_execute(
                "INSERT OR REPLACE INTO cloud_approvals (doc_id, approved_at) "
                "VALUES (?, ?)",
                (doc_id, datetime.now(UTC).isoformat()),
            )

    def log_cloud_send(self, doc_id: str, target_model: str, content_hash: str) -> None:
        self._audit.append({
            "doc_id": doc_id,
            "target_model": target_model,
            "content_hash": content_hash,
            "timestamp": datetime.now(UTC).isoformat(),
        })
        if self._storage:
            ts = datetime.now(UTC).isoformat()
            self._storage.sql_execute(
                "INSERT INTO audit_log (doc_id, target_model, content_hash, timestamp) "
                "VALUES (?, ?, ?, ?)",
                (doc_id, target_model, content_hash, ts),
            )
            self._storage.sql_execute(
                "DELETE FROM audit_log WHERE id NOT IN ("
                "  SELECT id FROM audit_log ORDER BY id DESC LIMIT ?"
                ")",
                (MAX_AUDIT_ENTRIES,),
            )

    def audit_log(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        if self._storage:
            rows = self._storage.sql_query(
                "SELECT doc_id, target_model, content_hash, timestamp "
                "FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            return [dict(r) for r in rows]
        return list(self._audit)
