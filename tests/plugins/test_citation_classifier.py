from backend.plugins.literature.citation_classifier import classify_citations, summarize_citations


class TestCitationClassifier:
    def test_empty_citations(self):
        result = classify_citations([])
        assert result == []

    def test_classify_known_types(self):
        citations = [
            {"title": "Attention Is All You Need", "context": "following the method of"},
            {"title": "BERT", "context": "previous work has shown"},
        ]
        result = classify_citations(citations)
        assert len(result) == 2
        for c in result:
            assert "classification" in c
            assert "intent" in c["classification"]

    def test_summarize_returns_dict(self):
        classified = [
            {"classification": {"intent": "methodology"}},
            {"classification": {"intent": "background"}},
            {"classification": {"intent": "methodology"}},
        ]
        summary = summarize_citations(classified)
        assert isinstance(summary, dict)
        assert "total_citations" in summary
        assert summary["total_citations"] == 3
