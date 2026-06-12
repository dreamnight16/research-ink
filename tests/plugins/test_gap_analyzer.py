from backend.plugins.evaluator.gap_analyzer import analyze_gaps


class TestGapAnalyzer:
    def test_empty_papers_returns_default_gaps(self):
        gaps = analyze_gaps([], "machine learning")
        assert len(gaps) > 0
        assert isinstance(gaps[0], dict)

    def test_single_paper_returns_analysis(self):
        papers = [{"title": "Deep Learning for NLP", "summary": "We propose a new transformer architecture."}]
        gaps = analyze_gaps(papers)
        assert len(gaps) > 0
        for gap in gaps:
            assert "direction" in gap or "dimension" in gap

    def test_multiple_papers_returns_non_empty(self):
        papers = [
            {"title": "Efficient Transformers", "summary": "We reduce FLOPs by 50% using pruning."},
            {"title": "Robust Fine-tuning", "summary": "Adversarial training improves OOD generalization."},
        ]
        gaps = analyze_gaps(papers)
        assert len(gaps) > 0
        for gap in gaps:
            assert "confidence" in gap
            assert isinstance(gap["confidence"], str)
