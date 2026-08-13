"""Pluggable academic paper crawlers.

Each crawler implements the BaseCrawler interface. Add new sources by
creating a subclass and registering it with the CrawlerManager.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CrawlerResult:
    papers: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    source: str = ""
    total_found: int = 0


class BaseCrawler(ABC):
    """Interface for academic paper sources."""

    name: str = "base"
    display_name: str = "Base"
    max_results_per_query: int = 20
    timeout: int = 30

    @abstractmethod
    async def search(self, query: str, max_results: int = 10) -> CrawlerResult:
        """Search for papers matching the query."""

    @abstractmethod
    def build_url(self, query: str, max_results: int) -> str | None:
        """Return the URL that would be fetched, for debugging."""


class CrawlerManager:
    """Routes queries to all registered crawlers and merges results."""

    def __init__(self):
        self._crawlers: list[BaseCrawler] = []

    def register(self, crawler: BaseCrawler) -> None:
        self._crawlers.append(crawler)

    @property
    def sources(self) -> list[str]:
        return [c.name for c in self._crawlers]

    async def search_all(
        self, query: str, max_results: int = 10, sources: list[str] | None = None
    ) -> CrawlerResult:
        """Search across all (or specified) crawlers, merge and deduplicate."""
        import asyncio

        targets = [
            c for c in self._crawlers
            if sources is None or c.name in sources
        ]

        tasks = [
            asyncio.create_task(c.search(query, max_results))
            for c in targets
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_papers: list[dict[str, Any]] = []
        all_errors: list[str] = []
        total = 0

        for i, r in enumerate(results):
            if isinstance(r, BaseException):
                all_errors.append(f"{targets[i].name}: {r}")
                continue
            all_papers.extend(r.papers)
            all_errors.extend(r.errors)
            total += r.total_found

        # Deduplicate by id
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for p in all_papers:
            paper_id = str(p.get("id", p.get("arxiv_id", "")))
            if paper_id and paper_id not in seen:
                seen.add(paper_id)
                unique.append(p)
            elif not paper_id:
                unique.append(p)

        unique.sort(key=lambda p: p.get("published", ""), reverse=True)
        return CrawlerResult(
            papers=unique[:max_results * 3],
            errors=all_errors,
            source="+".join(c.name for c in targets),
            total_found=total,
        )
