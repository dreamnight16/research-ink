"""Citation relationship graph builder.

Given a set of papers, builds a graph with:
- Nodes: papers
- Edges: shared keywords, shared authors, citation relationships
"""

import re
from collections import Counter
from typing import Any


def extract_keywords(text: str, n: int = 5) -> list[str]:
    """Extract significant keywords from title + summary."""
    words = re.findall(r"[A-Za-z][a-z]{3,}(?:\s+[A-Za-z][a-z]{3,})?", text.lower())
    stop = {"that", "this", "with", "from", "have", "been", "which", "their",
            "these", "those", "there", "about", "would", "could", "should",
            "paper", "propose", "method", "approach", "result", "experiment",
            "model", "based", "using", "show", "also", "used", "well", "new"}
    filtered = [w for w in words if w not in stop]
    counts = Counter(filtered)
    return [kw for kw, _ in counts.most_common(n)]


def build_graph(papers: list[dict[str, Any]], min_edge_weight: int = 1) -> dict[str, Any]:
    """Build a citation/relationship graph from a set of papers."""
    nodes = []
    node_keywords: list[list[str]] = []

    for i, paper in enumerate(papers):
        title = paper.get("title", f"Paper {i}")
        authors = paper.get("authors", "")
        year = paper.get("year", paper.get("published", "")[:4])

        keywords = extract_keywords(f"{title} {paper.get('summary', '')}")
        node_keywords.append(keywords)

        nodes.append({
            "id": str(i),
            "name": title[:60] + ("..." if len(title) > 60 else ""),
            "authors": authors.split(",")[:2] if authors else [],
            "year": year,
            "citations": paper.get("citations", 0),
            "symbolSize": 10 + min(paper.get("citations", 0) / 5, 30),
            "keywords": keywords[:5],
        })

    edges: list[dict[str, Any]] = []
    for i in range(len(papers)):
        for j in range(i + 1, len(papers)):
            shared_kw = set(node_keywords[i]) & set(node_keywords[j])
            if len(shared_kw) >= min_edge_weight:
                edges.append({
                    "source": str(i),
                    "target": str(j),
                    "weight": len(shared_kw),
                    "shared_keywords": list(shared_kw)[:3],
                })

    # Sort edges by weight descending
    edges.sort(key=lambda e: -e["weight"])

    return {
        "nodes": nodes,
        "edges": edges[:50],
        "total_nodes": len(nodes),
        "total_edges": len(edges),
    }
