"""DBLP Computer Science Bibliography crawler.

Covers CS conferences and journals not always on ArXiv.
API: https://dblp.org/search/publ/api
"""

from urllib.parse import quote_plus

import aiohttp
import feedparser

from backend.plugins.literature.crawlers import BaseCrawler, CrawlerResult


class DBLPCrawler(BaseCrawler):
    name = "dblp"
    display_name = "DBLP (CS Conferences)"
    max_results_per_query = 30

    BASE = "https://dblp.org/search/publ/api"

    def build_url(self, query: str, max_results: int) -> str | None:
        params = (
            f"q={quote_plus(query)}&h={max_results}&format=atom"
        )
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
                if resp.status != 200:
                    return CrawlerResult(
                        errors=[f"DBLP returned {resp.status}"],
                        source=self.name,
                    )
                text = await resp.text()
        except Exception as e:
            return CrawlerResult(errors=[str(e)], source=self.name)

        feed = feedparser.parse(text)
        papers = []
        for entry in feed.entries:
            authors = ", ".join(
                a.get("name", "") for a in entry.get("authors", [])
            )
            paper = {
                "id": entry.get("id", "").split("/rec/")[-1]
                      if "/rec/" in entry.get("id", "") else entry.get("id", ""),
                "title": entry.get("title", "").strip(),
                "summary": "",
                "authors": authors,
                "published": entry.get("published", ""),
                "link": entry.get("link", ""),
                "venue": entry.get("dblp_venue", ""),
            }
            papers.append(paper)

        total = int(feed.feed.get("opensearch_totalresults", len(papers)))
        return CrawlerResult(
            papers=papers,
            source=self.name,
            total_found=total,
        )
