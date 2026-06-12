"""De-AI text — remove common AI writing patterns from academic text.

Patterns sourced from Wikipedia's "AI 写作特征" guide and empirical testing
against Claude/GPT output on Chinese academic prose. Scoring thresholds calibrated
manually on ~200 samples. Accuracy not guaranteed — this is a heuristic tool.
"""

import re

# Precompiled patterns for detection and cleaning
_AI_PATTERNS = [
    (re.compile(r"此外[，,]\s*"), ""),
    (re.compile(r"至关重要"), "重要"),
    (re.compile(r"深入探讨"), "讨论"),
    (re.compile(r"值得注意的是[，,]?\s*"), ""),
    (re.compile(r"毋庸置疑[，,]?\s*"), ""),
    (re.compile(r"换言之[，,]?\s*"), "即"),
    (re.compile(r"不仅[，,]?\s*而且[，,]?\s*"), ""),
    (re.compile(r"这不仅仅是[^，,]+[，,]而是"), ""),
    # English AI vocabulary
    (re.compile(r"\bFurthermore[,]?\s*", re.IGNORECASE), ""),
    (re.compile(r"\bMoreover[,]?\s*", re.IGNORECASE), ""),
    (re.compile(r"\bIt is worth noting that\s*", re.IGNORECASE), ""),
    (re.compile(r"\bIt should be noted that\s*", re.IGNORECASE), ""),
    (re.compile(r"\bNot only\s+(\w+)\s+but also\s+", re.IGNORECASE), r"\1 "),
    # Dummy subjects
    (re.compile(r"\bIt is (important|crucial|essential|vital|critical) to\b", re.IGNORECASE), "You should"),
    (re.compile(r"\bIt can be (seen|observed|noted) that\b", re.IGNORECASE), ""),
    # Over-qualification
    (re.compile(r"\bpotentially\s+potentially\b", re.IGNORECASE), "potentially"),
    (re.compile(r"\bit may be possible that\b", re.IGNORECASE), "it may"),
    (re.compile(r"\bit could potentially be argued that\b", re.IGNORECASE), "it could be that"),
    # Vague attribution
    (re.compile(r"\bexperts believe that\b", re.IGNORECASE), ""),
    (re.compile(r"\bindustry reports show that\b", re.IGNORECASE), ""),
    (re.compile(r"\bobservers note that\b", re.IGNORECASE), ""),
    (re.compile(r"\bsome critics argue that\b", re.IGNORECASE), ""),
    # Overused emphasis
    (re.compile(r"\bplays? a (crucial|critical|vital|pivotal|key) role in\b", re.IGNORECASE), "is important in"),
    (re.compile(r"\bserves as a testament to\b", re.IGNORECASE), "demonstrates"),
    (re.compile(r"\bin the ever-evolving landscape of\b", re.IGNORECASE), "in"),
    # Triple patterns → break into two
    (re.compile(r"(\w+)、(\w+)和(\w+)"), r"\1 和 \2"),
    (re.compile(r"(\w+),\s*(\w+),\s*and\s*(\w+)", re.IGNORECASE), r"\1 and \2"),
]

# Sentence starts that sound like a chatbot
_CHATBOT_STARTS = [
    "当然", "让我来", "以下是", "这是一个",
    "希望这", "请告诉我", "基于上述",
]


_SENTENCE_SPLIT = re.compile(r"(?<=[。！？.!?])\s*")
_TRIPLE_CN = re.compile(r"[^,，]+[,，][^,，]+[,，][^,，和]+和")
_TRIPLE_EN = re.compile(r"\w+, \w+, and \w+", re.IGNORECASE)
_MULTI_SPACE = re.compile(r"\s{2,}")
_MULTI_COMMA = re.compile(r"[，,]{2,}")
_MULTI_PERIOD = re.compile(r"[。.]{2,}")
_MULTI_EXCL = re.compile(r"！{2,}")
_EMPTY_PAREN_ASCII = re.compile(r"\(\s*\)")
_EMPTY_PAREN_CJK = re.compile(r"（\s*）")


def deai_text(text: str) -> str:
    """Remove common AI writing patterns from text."""
    result = text

    for pattern, replacement in _AI_PATTERNS:
        result = pattern.sub(replacement, result)

    sentences = _SENTENCE_SPLIT.split(result)
    filtered = [s.strip() for s in sentences if s.strip()]
    result = "。".join(
        s for s in filtered
        if not any(s.startswith(prefix) for prefix in _CHATBOT_STARTS)
    )

    result = _MULTI_SPACE.sub(" ", result)
    result = _MULTI_COMMA.sub("，", result)
    result = _MULTI_PERIOD.sub("。", result)
    result = _MULTI_EXCL.sub("！", result)
    result = result.replace("。。", "。").replace("，，", "，")
    result = _EMPTY_PAREN_ASCII.sub("", result)
    result = _EMPTY_PAREN_CJK.sub("", result)

    return result.strip()


def detect_ai_score(text: str) -> dict:
    """Score how likely a text is AI-generated. Lower = more human."""
    if not text.strip():
        return {"score": 0, "flags": [], "summary": "空文本"}

    flags = []
    score = 0

    ai_words = [
        "此外", "至关重要", "深入探讨", "值得注意的是", "毋庸置疑",
        "Furthermore", "Moreover", "It is worth noting",
        "serves as", "plays a crucial role", "ever-evolving landscape",
        "pivotal", "testament", "showcases", "underscores",
        "不仅如此", "与此同时", "在此背景下",
    ]
    word_count = 0
    for word in ai_words:
        count = len(re.findall(re.escape(word), text, re.IGNORECASE))
        if count > 0:
            word_count += count
            flags.append(f"AI词汇: '{word}' 出现 {count} 次")
    score += min(word_count * 2, 20)

    em_dash_count = text.count("—") + text.count("--")
    if em_dash_count > 2:
        flags.append(f"破折号过多: {em_dash_count} 处")
        score += min(em_dash_count, 10)

    triple_count = len(_TRIPLE_CN.findall(text)) + len(_TRIPLE_EN.findall(text))
    if triple_count > 1:
        flags.append(f"三段式列举: {triple_count} 处")
        score += min(triple_count * 3, 10)

    for s in _SENTENCE_SPLIT.split(text):
        for prefix in _CHATBOT_STARTS:
            if s.strip().startswith(prefix):
                flags.append(f"聊天机器人开头: '{s.strip()[:20]}...'")
                score += 3
                break

    lengths = [len(s.strip()) for s in _SENTENCE_SPLIT.split(text) if s.strip()]
    if len(lengths) >= 3:
        avg = sum(lengths) / len(lengths)
        uniform = sum(1 for l in lengths if abs(l - avg) < 10) / len(lengths)
        if uniform > 0.7:
            flags.append("句子长度过于均匀")
            score += 5

    score = min(score, 100)
    summary = "读起来自然" if score < 15 else ("有些AI痕迹" if score < 30 else "AI痕迹较重")
    return {"score": score, "flags": flags[:8], "summary": summary}
