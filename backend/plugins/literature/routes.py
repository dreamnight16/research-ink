from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.plugins.literature.citation_classifier import classify_citations, summarize_citations
from backend.plugins.literature.citation_graph import build_graph
from backend.plugins.literature.crawlers import CrawlerManager
from backend.plugins.literature.crawlers.arxiv import ArxivCrawler
from backend.plugins.literature.crawlers.dblp import DBLPCrawler
from backend.plugins.literature.crawlers.semantic_scholar import SemanticScholarCrawler
from backend.plugins.literature.dedup import deduplicate
from backend.plugins.literature.summarizer import summarize_paper
from backend.plugins.literature.systematic_review import get_workflow


class FetchRequest(BaseModel):
    query: str = Field(max_length=500)
    max_results: int = Field(default=10, ge=1, le=50)
    sources: list[str] | None = Field(default=None, max_length=10)


class InterestsUpdate(BaseModel):
    keywords: list[str] = Field(max_length=20, min_length=0)


def _get_manager() -> CrawlerManager:
    manager = CrawlerManager()
    manager.register(ArxivCrawler())
    manager.register(SemanticScholarCrawler())
    manager.register(DBLPCrawler())
    return manager


def create_router(plugin) -> APIRouter:
    router = APIRouter(prefix="/api/literature", tags=["literature"])
    manager = _get_manager()

    @router.get("/sources")
    async def list_sources():
        return {"sources": [
            {"name": c.name, "display_name": c.display_name}
            for c in manager._crawlers
        ]}

    @router.get("/interests")
    async def get_interests(request: Request):
        storage = request.app.state.storage
        rows = storage.sql_query("SELECT value FROM kv WHERE key = 'literature_interests'")
        if rows:
            import json
            try:
                return {"keywords": json.loads(rows[0]["value"])}
            except (json.JSONDecodeError, IndexError):
                pass
        return {"keywords": []}

    @router.put("/interests")
    async def set_interests(req: InterestsUpdate, request: Request):
        storage = request.app.state.storage
        import json
        storage.sql_execute(
            "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
            ("literature_interests", json.dumps(req.keywords)),
        )
        return {"status": "ok", "keywords": req.keywords}

    @router.post("/feed")
    async def get_feed(request: Request):
        storage = request.app.state.storage
        rows = storage.sql_query("SELECT value FROM kv WHERE key = 'literature_interests'")

        import json
        keywords: list[str] = []
        if rows:
            try:
                keywords = json.loads(rows[0]["value"])
            except (json.JSONDecodeError, IndexError):
                keywords = []

        queries = keywords if keywords else ["machine learning"]

        all_papers: list[dict] = []
        errors: list[str] = []

        for kw in queries[:3]:
            result = await manager.search_all(kw, max_results=8)
            all_papers.extend(result.papers)
            errors.extend(result.errors)

        seen: set[str] = set()
        unique: list[dict] = []
        for p in all_papers:
            pid = p.get("id") or p.get("arxiv_id", "")
            if pid and pid not in seen:
                seen.add(pid)
                unique.append(p)
            elif not pid:
                unique.append(p)

        unique.sort(key=lambda p: p.get("published", ""), reverse=True)
        deduped = deduplicate(unique)
        return {
            "papers": deduped[:30],
            "total": len(deduped),
            "duplicates_removed": len(unique) - len(deduped),
            "interests": keywords,
            "sources": manager.sources,
            "errors": errors[:5],
        }

    @router.post("/fetch")
    async def fetch_papers(req: FetchRequest):
        result = await manager.search_all(req.query, req.max_results, req.sources)
        return {
            "papers": result.papers,
            "total": result.total_found,
            "sources": result.source,
            "errors": result.errors[:5],
        }

    class SummarizeRequest(BaseModel):
        title: str = Field(max_length=500)
        summary: str = Field(max_length=5000)

    class ClassifyCitationsRequest(BaseModel):
        citations: list[dict] = Field(max_length=200)

    class CitationGraphRequest(BaseModel):
        papers: list[dict] = Field(max_length=200)

    @router.post("/summarize")
    async def summarize(req: SummarizeRequest, request: Request):
        router_llm = request.app.state.llm_router
        summary = await summarize_paper(req.model_dump(), router_llm)
        return {"summary": summary}

    @router.post("/classify-citations")
    async def classify_cites(data: ClassifyCitationsRequest):
        classified = classify_citations(data.citations)
        summary = summarize_citations(classified)
        return {"classified": classified, "summary": summary}

    @router.post("/citation-graph")
    async def citation_graph(data: CitationGraphRequest):
        graph = build_graph(data.papers)
        return graph

    @router.get("/systematic-review")
    async def systematic_review():
        return {"workflow": get_workflow()}

    return router
