from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.plugins.evaluator.evaluate import evaluate_project
from backend.plugins.evaluator.gap_analyzer import analyze_gaps


class EvalRequest(BaseModel):
    title: str = Field(max_length=500)
    description: str = Field(max_length=5000)
    field: str = Field(default="", max_length=200)


class GapRequest(BaseModel):
    papers: list[dict] = Field(max_length=200)
    field: str = Field(default="", max_length=200)


def create_router(plugin) -> APIRouter:
    router = APIRouter(prefix="/api/evaluator", tags=["evaluator"])

    @router.post("/evaluate")
    async def evaluate(req: EvalRequest):
        result = evaluate_project(req.title, req.description, req.field)
        return {
            "title": result.title,
            "innovation_score": result.innovation_score,
            "rationality_score": result.rationality_score,
            "methodology_score": result.methodology_score,
            "strengths": result.strengths,
            "weaknesses": result.weaknesses,
            "suggestions": result.suggestions,
        }

    @router.post("/gap-analysis")
    async def gap_analysis(req: GapRequest):
        gaps = analyze_gaps(req.papers, req.field)
        return {"gaps": gaps, "paper_count": len(req.papers)}

    return router
