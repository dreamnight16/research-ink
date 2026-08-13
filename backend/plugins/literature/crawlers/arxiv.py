"""ArXiv API crawler."""

from backend.plugins.literature.crawlers import BaseCrawler, CrawlerResult
from backend.plugins.literature.fetcher import ArxivFetcher


class ArxivCrawler(BaseCrawler):
    name = "arxiv"
    display_name = "ArXiv"
    _fetcher: ArxivFetcher

    def __init__(self):
        self._fetcher = ArxivFetcher()

    def build_url(self, query: str, max_results: int) -> str | None:
        return self._fetcher.build_query_url(query, min(max_results, self.max_results_per_query))

    async def search(self, query: str, max_results: int = 10) -> CrawlerResult:
        try:
            papers = await self._fetcher.fetch(query, min(max_results, self.max_results_per_query))
            return CrawlerResult(papers=papers, source=self.name, total_found=len(papers))
        except Exception as e:
            return CrawlerResult(errors=[str(e)], source=self.name)
