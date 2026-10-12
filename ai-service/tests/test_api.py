from fastapi.testclient import TestClient

from app.main import app, feedback_analyzer, planner
from app.models import (
    Activity,
    FeedbackAnalysis,
    FeedbackRequest,
    PlanRequest,
    PlanResponse,
)


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_plan(monkeypatch) -> None:
    async def fake_create_plan(request: PlanRequest) -> PlanResponse:
        return PlanResponse(
            title="A focused reading break",
            activities=[
                Activity(
                    goal_id=request.goals[0].id,
                    title="Read your current book",
                    minutes=request.minutes,
                    instructions="Continue from where you stopped.",
                )
            ],
            motivation="One focused block is meaningful progress.",
        )

    monkeypatch.setattr(planner, "create_plan", fake_create_plan)

    response = client.post(
        "/ai/sessions/plan",
        json={
            "minutes": 20,
            "energy": "low",
            "goals": [
                {
                    "id": "goal-1",
                    "title": "Read more",
                    "category": "reading",
                    "context": {},
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["activities"][0]["minutes"] == 20


def test_analyze_feedback(monkeypatch) -> None:
    async def fake_analyze(request: FeedbackRequest) -> FeedbackAnalysis:
        assert request.completed is True
        return FeedbackAnalysis(
            summary="The planned reading session was completed.",
            encouragement="You protected time for something meaningful.",
            observations=["The selected duration was achievable."],
            future_adjustments=["Keep this duration for low-energy sessions."],
        )

    monkeypatch.setattr(feedback_analyzer, "analyze", fake_analyze)

    response = client.post(
        "/ai/sessions/analyze",
        json={
            "session_id": "session-1",
            "session_title": "Reading break",
            "requested_minutes": 20,
            "energy": "low",
            "activities": [
                {
                    "title": "Read your book",
                    "planned_minutes": 20,
                    "goal_id": "goal-1",
                }
            ],
            "completed": True,
            "difficulty": "okay",
            "notes": "It felt manageable.",
        },
    )

    assert response.status_code == 200
    assert response.json()["future_adjustments"] == [
        "Keep this duration for low-energy sessions."
    ]
