from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from .feedback import FeedbackAnalyzer
from .models import (
    FeedbackAnalysis,
    FeedbackRequest,
    PlanRequest,
    PlanResponse,
)
from .planner import Planner

app = FastAPI(title="OFFSCREEN AI Service", version="0.1.0")
planner = Planner()
feedback_analyzer = FeedbackAnalyzer()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ai/sessions/plan", response_model=PlanResponse)
async def create_plan(request: PlanRequest) -> PlanResponse:
    return await planner.create_plan(request)


@app.post("/ai/sessions/analyze", response_model=FeedbackAnalysis)
async def analyze_feedback(request: FeedbackRequest) -> FeedbackAnalysis:
    return await feedback_analyzer.analyze(request)
