"""Smart citation classifier — classifies citations as supporting, contrasting,
background, or methodology based on citation context heuristics."""

from enum import StrEnum
from typing import Any


class CitationIntent(StrEnum):
    SUPPORTING = "supporting"
    CONTRASTING = "contrasting"
    BACKGROUND = "background"
    METHODOLOGY = "methodology"
    EXTENDING = "extending"
    UNKNOWN = "unknown"


SUPPORTING_PATTERNS = [
    "similar to", "consistent with", "in line with", "confirm",
    "corroborate", "validate", "support", "agree with",
    "as demonstrated by", "as shown in", "following",
    "一致", "验证", "支持", "确认", "符合", "印证",
    "state-of-the-art", "outperform", "achieve",
]

CONTRASTING_PATTERNS = [
    "however", "in contrast", "on the other hand", "disagree",
    "contradict", "challenge", "fail to", "unlike",
    "limitation", "drawback", "shortcoming", "not address",
    "然而", "但是", "相反", "不足", "局限", "未能",
    "contrary to", "discrepancy", "inconsistent",
]

BACKGROUND_PATTERNS = [
    "previous work", "prior art", "existing methods", "traditionally",
    "has been studied", "widely used", "well-known", "established",
    "前人", "已有", "传统", "广泛", "经典",
    "survey", "review", "overview", "introduced",
]

METHODOLOGY_PATTERNS = [
    "following the method of", "as described in", "using the approach",
    "implemented as in", "based on the framework", "adapt",
    "采用", "按照", "基于", "参考", "沿用",
    "we use", "we adopt", "we follow", "we employ",
]


def classify_citation(context: str, title: str = "") -> dict[str, Any]:
    """Classify a single citation based on its surrounding context text."""
    ctx_lower = context.lower()

    scores = {
        CitationIntent.SUPPORTING: _count_matches(ctx_lower, SUPPORTING_PATTERNS),
        CitationIntent.CONTRASTING: _count_matches(ctx_lower, CONTRASTING_PATTERNS),
        CitationIntent.BACKGROUND: _count_matches(ctx_lower, BACKGROUND_PATTERNS),
        CitationIntent.METHODOLOGY: _count_matches(ctx_lower, METHODOLOGY_PATTERNS),
        CitationIntent.EXTENDING: 0,
    }

    # Extension is a special case: supporting + "we extend/improve/propose"
    extend_patterns = ["we extend", "we improve", "we propose", "we build upon",
                       "改进", "扩展", "提出", "我们在此基础"]
    if any(p in ctx_lower for p in extend_patterns):
        scores[CitationIntent.EXTENDING] = _count_matches(ctx_lower, extend_patterns) + 1

    best = max(scores, key=lambda k: scores[k])
    if scores[best] == 0:
        best = CitationIntent.UNKNOWN

    total = sum(scores.values()) or 1
    return {
        "intent": best.value,
        "confidence": round(scores[best] / total, 2),
        "scores": {k.value: v for k, v in scores.items()},
    }


def classify_citations(citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Classify a list of citations."""
    results = []
    for cite in citations:
        context = cite.get("context", cite.get("sentence", ""))
        title = cite.get("title", "")
        classification = classify_citation(context, title)
        results.append({**cite, "classification": classification})
    return results


def summarize_citations(classified: list[dict[str, Any]]) -> dict[str, Any]:
    """Generate a summary of citation intents across a set of papers."""
    counts = {v.value: 0 for v in CitationIntent}
    for c in classified:
        intent = c.get("classification", {}).get("intent", "unknown")
        counts[intent] = counts.get(intent, 0) + 1

    total = len(classified) or 1
    return {
        "total_citations": total,
        "breakdown": counts,
        "supporting_pct": round(counts["supporting"] / total * 100),
        "contrasting_pct": round(counts["contrasting"] / total * 100),
        "background_pct": round(counts["background"] / total * 100),
        "methodology_pct": round(counts["methodology"] / total * 100),
    }


def _count_matches(text: str, patterns: list[str]) -> int:
    return sum(1 for p in patterns if p in text)
