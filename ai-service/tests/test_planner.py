import pytest
from fastapi import HTTPException

from app.models import Activity, Goal, PlanRequest, PlanResponse
from app.planner import Planner


def request() -> PlanRequest:
    return PlanRequest(
        minutes=20,
        energy="low",
        goals=[
            Goal(
                id="goal-1",
                title="Read more",
                category="reading",
            )
        ],
    )


def test_accepts_a_grounded_plan_with_the_exact_duration() -> None:
    plan = PlanResponse(
        title="Quiet reading session",
        activities=[
            Activity(
                goal_id="goal-1",
                title="Read your current book",
                minutes=20,
                instructions="Continue from your saved position.",
            )
        ],
        motivation="A small session still moves the goal forward.",
    )

    Planner._validate_plan(request(), plan)


def test_rejects_a_duration_mismatch() -> None:
    plan = PlanResponse(
        title="Too short",
        activities=[
            Activity(
                goal_id="goal-1",
                title="Read",
                minutes=10,
                instructions="Read your current book.",
            )
        ],
        motivation="Begin.",
    )

    with pytest.raises(HTTPException) as error:
        Planner._validate_plan(request(), plan)

    assert error.value.status_code == 502


def test_rejects_an_unknown_goal() -> None:
    plan = PlanResponse(
        title="Unknown goal",
        activities=[
            Activity(
                goal_id="goal-2",
                title="Read",
                minutes=20,
                instructions="Read your current book.",
            )
        ],
        motivation="Begin.",
    )

    with pytest.raises(HTTPException) as error:
        Planner._validate_plan(request(), plan)

    assert error.value.status_code == 502

