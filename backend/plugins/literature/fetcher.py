from typing import Any
from urllib.parse import quote_plus

import aiohttp
import feedparser


class ArxivFetcher:
    BASE = "https://export.arxiv.org/api/query"

    def build_query_url(self, query: str, max_results: int = 10) -> str:
        encoded = quote_plus(query)
        return f"{self.BASE}?search_query={encoded}&start=0&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"

    def parse_entry(self, entry: dict[str, Any]) -> dict[str, Any]:
        authors = ", ".join(a.get("name", "") for a in entry.get("authors", []))
        return {
            "arxiv_id": entry.get("id", "").split("/abs/")[-1],
            "title": entry.get("title", "").strip().replace("\n", " "),
            "summary": entry.get("summary", "").strip().replace("\n", " "),
            "authors": authors,
            "published": entry.get("published", ""),
            "link": entry.get("link", ""),
        }

    async def fetch(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        url = self.build_query_url(query, min(max_results, 100))
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    return []
                text = await resp.text()
        parsed = feedparser.parse(text)
        return [self.parse_entry(e) for e in parsed.entries]
