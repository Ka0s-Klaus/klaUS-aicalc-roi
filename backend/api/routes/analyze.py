"""POST /v1/analyze — TCO analysis endpoint."""

from fastapi import APIRouter

from backend.tco_engine import TCOEngine
from backend.tco_engine.models import AnalysisResult, TCOInput

router = APIRouter(prefix="/v1", tags=["analysis"])

_engine = TCOEngine()


@router.post("/analyze")
async def analyze(payload: TCOInput) -> AnalysisResult:
    """Run a full TCO analysis and return strategies, Pareto frontier and recommendation."""
    return _engine.analyze(payload)
