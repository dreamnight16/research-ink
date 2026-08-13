"""Semantic Scholar API crawler.

Free tier: 100 requests/5min without API key.
Docs: https://api.semanticscholar.org/api-docs/
"""

from urllib.parse import quote_plus

import aiohttp

from backend.plugins.literature.crawlers import BaseCrawler, CrawlerResult


class SemanticScholarCrawler(BaseCrawler):
    name = "semantic_scholar"
    display_name = "Semantic Scholar"
    max_results_per_query = 20

    BASE = "https://api.semanticscholar.org/graph/v1/paper/search"

    FIELDS = [
        "title", "abstract", "authors", "year", "externalIds",
        "url", "publicationDate", "publicationVenue", "citationCount",
    ]

    def build_url(self, query: str, max_results: int) -> str | None:
        fields = ",".join(self.FIELDS)
        params = f"query={quote_plus(query)}&limit={max_results}&fields={fields}"
        return f"{self.BASE}?{params}"

    async def search(self, query: str, max_results: int = 10) -> CrawlerResult:
        limit = min(max_results, self.max_results_per_query)
        url = self.build_url(query, limit)
        assert url is not None

        try:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            async with (
                aiohttp.ClientSession(timeout=timeout) as session,
                session.get(url) as resp,
            ):
                if resp.status == 429:
                    return CrawlerResult(
                        errors=["Semantic Scholar rate limited, wait 5 minutes"],
                        source=self.name,
                    )
                if resp.status != 200:
                    return CrawlerResult(
                        errors=[f"Semantic Scholar returned {resp.status}"],
                        source=self.name,
                    )
                data = await resp.json()
        except Exception as e:
            return CrawlerResult(errors=[str(e)], source=self.name)

        papers = []
        for item in data.get("data", []):
            authors = ", ".join(
                a.get("name", "") for a in item.get("authors", [])
            )
            ext = item.get("externalIds", {}) or {}
            paper = {
                "id": item.get("paperId", ""),
                "title": item.get("title", ""),
                "summary": item.get("abstract", "") or "",
                "authors": authors,
                "published": item.get("publicationDate", ""),
                "year": item.get("year", ""),
                "link": item.get("url", "")
                        or f"https://api.semanticscholar.org/{item.get('paperId', '')}",
                "venue": item.get("publicationVenue", {}) or {},
                "citations": item.get("citationCount", 0),
                "arxiv_id": ext.get("ArXiv", ""),
                "doi": ext.get("DOI", ""),
            }
            papers.append(paper)

        return CrawlerResult(
            papers=papers,
            source=self.name,
            total_found=data.get("total", len(papers)),
        )
