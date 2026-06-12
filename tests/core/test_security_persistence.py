import pytest
from backend.core.security import SecurityManager, Classification
from backend.core.storage import Storage
from backend.core.schema import ensure_schema


class TestSecurityPersistence:
    def test_classifications_survive_restart(self, tmp_data_dir):
        s1 = Storage(tmp_data_dir)
        ensure_schema(s1)
        sm1 = SecurityManager(storage=s1)
        sm1.mark("doc-42", Classification.SECRET)
        assert sm1.classification_of("doc-42") == Classification.SECRET
        s1.close()

        s2 = Storage(tmp_data_dir)
        sm2 = SecurityManager(storage=s2)
        assert sm2.classification_of("doc-42") == Classification.SECRET
        s2.close()

    def test_cloud_approvals_persist(self, tmp_data_dir):
        s1 = Storage(tmp_data_dir)
        ensure_schema(s1)
        sm1 = SecurityManager(storage=s1)
        sm1.mark("doc-5", Classification.CAUTIOUS)
        sm1.approve_cloud("doc-5")
        assert sm1.allow_cloud("doc-5") is True
        s1.close()

        s2 = Storage(tmp_data_dir)
        sm2 = SecurityManager(storage=s2)
        assert sm2.allow_cloud("doc-5") is True
        s2.close()

    def test_audit_log_persists(self, tmp_data_dir):
        s1 = Storage(tmp_data_dir)
        ensure_schema(s1)
        sm1 = SecurityManager(storage=s1)
        sm1.log_cloud_send("d1", "claude", "hash1")
        assert len(sm1.audit_log()) == 1
        s1.close()

        s2 = Storage(tmp_data_dir)
        sm2 = SecurityManager(storage=s2)
        log = sm2.audit_log()
        assert len(log) == 1
        assert log[0]["doc_id"] == "d1"
        s2.close()

    def test_audit_log_pagination(self, tmp_data_dir):
        s = Storage(tmp_data_dir)
        ensure_schema(s)
        sm = SecurityManager(storage=s)
        for i in range(10):
            sm.log_cloud_send(f"doc-{i}", "openai", f"hash-{i}")
        assert len(sm.audit_log(limit=5)) == 5
        assert len(sm.audit_log(limit=5, offset=5)) == 5
        s.close()

    def test_secret_blocks_cloud_even_with_approval(self, tmp_data_dir):
        s = Storage(tmp_data_dir)
        ensure_schema(s)
        sm = SecurityManager(storage=s)
        sm.mark("secret-doc", Classification.SECRET)
        sm.approve_cloud("secret-doc")
        assert sm.allow_cloud("secret-doc") is False
        s.close()

    def test_memory_fallback_without_storage(self):
        sm = SecurityManager(storage=None)
        sm.mark("m1", Classification.PUBLIC)
        assert sm.classification_of("m1") == Classification.PUBLIC
        sm.log_cloud_send("m1", "claude", "h1")
        assert len(sm.audit_log()) == 1
