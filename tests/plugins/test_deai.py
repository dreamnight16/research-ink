from backend.plugins.paper_writer.deai import deai_text, detect_ai_score


class TestDeAI:
    def test_empty_text_returns_zero_score(self):
        result = detect_ai_score("")
        assert result["score"] == 0
        assert result["summary"] == "空文本"

    def test_natural_text_has_low_score(self):
        result = detect_ai_score("今天天气很好，我和朋友去公园散步。")
        assert result["score"] < 30

    def test_ai_vocabulary_detected(self):
        text = "此外，值得注意的是，深入探讨这个问题至关重要。毋庸置疑，这是一个技术问题。此外此外。"
        result = detect_ai_score(text)
        assert result["score"] >= 10

    def test_deai_removes_ai_patterns(self):
        text = "此外，值得注意的是，这个问题至关重要。"
        cleaned = deai_text(text)
        assert "此外" not in cleaned
        assert "至关重要" not in cleaned

    def test_deai_preserves_normal_content(self):
        text = "机器学习是人工智能的一个重要分支。"
        cleaned = deai_text(text)
        assert "机器学习" in cleaned
