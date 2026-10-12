import asyncio
from unittest.mock import AsyncMock

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


def test_retries_an_invalid_plan_with_correction() -> None:
    planner = Planner()
    invalid_plan = PlanResponse(
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
    corrected_plan = PlanResponse(
        title="Quiet reading session",
        activities=[
            Activity(
                goal_id="goal-1",
                title="Read",
                minutes=20,
                instructions="Read your current book.",
            )
        ],
        motivation="Begin.",
    )
    planner.ollama.generate = AsyncMock(
        side_effect=[invalid_plan, corrected_plan]
    )

    result = asyncio.run(planner.create_plan(request()))

    assert result == corrected_plan
    assert planner.ollama.generate.await_count == 2
    correction = planner.ollama.generate.await_args_list[1].kwargs["user_content"]
    assert "add up exactly" in correction


def test_uses_a_grounded_fallback_after_two_invalid_responses() -> None:
    planner = Planner()
    invalid_plan = PlanResponse(
        title="Too short",
        activities=[
            Activity(
                goal_id=None,
                title="Read",
                minutes=10,
                instructions="Read your current book.",
            )
        ],
        motivation="Begin.",
    )
    planner.ollama.generate = AsyncMock(return_value=invalid_plan)

    result = asyncio.run(planner.create_plan(request()))

    assert sum(activity.minutes for activity in result.activities) == 20
    assert result.activities[0].goal_id == "goal-1"
    assert planner.ollama.generate.await_count == 2


def test_does_not_hide_an_unavailable_model() -> None:
    planner = Planner()
    planner.ollama.generate = AsyncMock(
        side_effect=HTTPException(status_code=503, detail="Ollama unavailable")
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(planner.create_plan(request()))

    assert error.value.status_code == 503
    assert planner.ollama.generate.await_count == 1
