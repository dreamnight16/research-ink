"""Paper deduplication by title similarity, arxiv_id, and DOI."""

import re
from difflib import SequenceMatcher
from typing import Any


def normalize_title(title: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    t = title.lower()
    t = re.sub(r"[^a-z0-9一-鿿\s]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def title_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_title(a), normalize_title(b)).ratio()


DEDUP_FULL_THRESHOLD = 500

def deduplicate(papers: list[dict[str, Any]], threshold: float = 0.85) -> list[dict[str, Any]]:
    """Remove duplicate papers by ID, DOI, and title similarity."""
    seen_ids: set[str] = set()
    dois: set[str] = set()
    # For very large lists, skip O(n²) title similarity to avoid performance degradation
    if len(papers) > DEDUP_FULL_THRESHOLD:
        threshold = 1.0
    titles: list[tuple[str, str]] = []  # (normalized_title, paper_id)
    result: list[dict[str, Any]] = []

    for paper in papers:
        pid = paper.get("id") or paper.get("arxiv_id", "")
        doi = (paper.get("doi") or "").lower()

        # Exact ID match
        if pid and pid in seen_ids:
            continue
        # DOI match
        if doi and doi in dois:
            continue

        # Title similarity check
        title = paper.get("title", "")
        norm = normalize_title(title)
        is_dup = False
        for existing_norm, _ in titles:
            if SequenceMatcher(None, norm, existing_norm).ratio() >= threshold:
                is_dup = True
                break
        if is_dup:
            continue

        if pid:
            seen_ids.add(pid)
        if doi:
            dois.add(doi)
        if norm:
            titles.append((norm, pid))

        result.append(paper)

    return result


def find_near_duplicates(papers: list[dict[str, Any]], threshold: float = 0.75) -> list[dict[str, Any]]:
    """Find pairs of papers that are suspiciously similar but not exact dupes."""
    pairs: list[dict[str, Any]] = []
    for i in range(len(papers)):
        for j in range(i + 1, len(papers)):
            sim = title_similarity(papers[i].get("title", ""), papers[j].get("title", ""))
            if sim >= threshold and sim < 0.95:
                pairs.append({
                    "paper_a": papers[i].get("title", ""),
                    "paper_b": papers[j].get("title", ""),
                    "similarity": round(sim, 3),
                })
    pairs.sort(key=lambda x: -x["similarity"])
    return pairs[:10]
