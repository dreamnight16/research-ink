from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.plugins.paper_writer.citation import parse_bibtex
from backend.plugins.paper_writer.deai import deai_text, detect_ai_score
from backend.plugins.paper_writer.outline import generate_outline


class OutlineRequest(BaseModel):
    topic: str = Field(max_length=500)


class BibtexRequest(BaseModel):
    bibtex: str = Field(max_length=50000)


class DeAIRequest(BaseModel):
    text: str = Field(max_length=50000)


def create_router(plugin) -> APIRouter:
    router = APIRouter(prefix="/api/paper-writer", tags=["paper-writer"])

    @router.post("/outline")
    async def outline(req: OutlineRequest):
        sections = generate_outline(req.topic)
        return {
            "sections": [
                {"title": s.title, "key_points": s.key_points, "estimated_words": s.estimated_words}
                for s in sections
            ]
        }

    @router.post("/citation/parse")
    async def parse_citation(req: BibtexRequest):
        entries = parse_bibtex(req.bibtex)
        return {
            "entries": [
                {"cite_key": e.cite_key, "title": e.title, "author": e.author,
                 "year": e.year, "journal": e.journal or e.booktitle}
                for e in entries
            ]
        }

    @router.post("/deai")
    async def deai(req: DeAIRequest):
        score = detect_ai_score(req.text)
        cleaned = deai_text(req.text)
        return {
            "original_score": score["score"],
            "original_flags": score["flags"],
            "original_summary": score["summary"],
            "cleaned_text": cleaned,
            "cleaned_score": detect_ai_score(cleaned)["score"],
        }

    return router
