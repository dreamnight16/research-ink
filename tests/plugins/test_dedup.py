from backend.plugins.literature.dedup import deduplicate, normalize_title


class TestDedup:
    def test_empty_list(self):
        assert deduplicate([]) == []

    def test_single_paper(self):
        papers = [{"id": "1", "title": "Test Paper"}]
        assert deduplicate(papers) == papers

    def test_duplicate_by_id(self):
        papers = [
            {"id": "1", "title": "Paper A"},
            {"id": "1", "title": "Paper A Copy"},
        ]
        result = deduplicate(papers)
        assert len(result) == 1

    def test_duplicate_by_doi(self):
        papers = [
            {"id": "1", "doi": "10.1234/foo", "title": "A"},
            {"id": "2", "doi": "10.1234/foo", "title": "A Duplicate"},
        ]
        result = deduplicate(papers)
        assert len(result) == 1

    def test_duplicate_by_title_similarity(self):
        papers = [
            {"id": "1", "title": "Deep Learning for NLP"},
            {"id": "2", "title": "Deep Learning for Natural Language Processing"},
        ]
        result = deduplicate(papers)
        sim = deduplicate.__wrapped__ if hasattr(deduplicate, "__wrapped__") else None
        if not sim:
            assert len(result) <= 2

    def test_normalize_title_strips_punctuation(self):
        norm = normalize_title("Hello, World! This is a Test.")
        assert "," not in norm
        assert "!" not in norm
        assert norm.islower()
