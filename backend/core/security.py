from collections import deque
from enum import Enum
from datetime import datetime, timezone
from typing import Any


class Classification(str, Enum):
    SECRET = "secret"
    CAUTIOUS = "cautious"
    PUBLIC = "public"


MAX_AUDIT_ENTRIES = 10000

class SecurityManager:
    def __init__(self) -> None:
        self._classifications: dict[str, Classification] = {}
        self._cloud_approvals: set[str] = set()
        self._audit: deque[dict[str, Any]] = deque(maxlen=MAX_AUDIT_ENTRIES)

    def mark(self, doc_id: str, level: Classification) -> None:
        self._classifications[doc_id] = level

    def classify_batch(self, mapping: dict[str, Classification]) -> None:
        self._classifications.update(mapping)

    def classification_of(self, doc_id: str) -> Classification:
        return self._classifications.get(doc_id, Classification.CAUTIOUS)

    def allow_cloud(self, doc_id: str) -> bool:
        level = self.classification_of(doc_id)
        if level == Classification.SECRET:
            return False
        if level == Classification.PUBLIC:
            return True
        return doc_id in self._cloud_approvals

    def approve_cloud(self, doc_id: str) -> None:
        self._cloud_approvals.add(doc_id)

    def log_cloud_send(self, doc_id: str, target_model: str, content_hash: str) -> None:
        self._audit.append({
            "doc_id": doc_id,
            "target_model": target_model,
            "content_hash": content_hash,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def audit_log(self) -> list[dict[str, Any]]:
        return list(self._audit)

    def audit_log_persist(self, path: str, allowed_base_dir: str | None = None) -> None:
        """将审计日志追加写入磁盘文件（路径限定在 allowed_base_dir 内）。"""
        import json
        import os
        if allowed_base_dir is not None:
            real_path = os.path.realpath(path)
            real_base = os.path.realpath(allowed_base_dir)
            if not (real_path.startswith(real_base + os.sep) or real_path == real_base):
                raise ValueError("Audit log path must be within the allowed base directory")
        entries = list(self._audit)
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "a") as f:
            for entry in entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        self._audit.clear()
