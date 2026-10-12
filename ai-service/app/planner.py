from fastapi import HTTPException

import json

from .models import Activity, PlanRequest, PlanResponse
from .ollama_client import OllamaClient


SYSTEM_PROMPT = """You are the activity planner for OFFSCREEN, an app that helps
people leave their screens and make realistic progress on personal goals.

Create a practical offline plan using only the supplied goals and context.
Respect the user's energy level. Do not invent progress or book contents.
Use recent feedback only for evidence-based adjustments. Prefer repeated patterns
over one-off events, and do not punish missed sessions.
Every activity must be safe, specific, and immediately actionable.
The activity minutes must add up exactly to the requested minutes.
Return only data matching the supplied JSON schema.
"""


class Planner:
    def __init__(self) -> None:
        self.ollama = OllamaClient()

    async def create_plan(self, request: PlanRequest) -> PlanResponse:
        user_content = request.model_dump_json()

        for attempt in range(2):
            try:
                plan = await self.ollama.generate(
                    system_prompt=SYSTEM_PROMPT,
                    user_content=user_content,
                    response_model=PlanResponse,
                )
                self._validate_plan(request, plan)
                return plan
            except HTTPException as error:
                if error.status_code != 502:
                    raise

                if attempt == 1:
                    return self._fallback_plan(request)

                user_content = json.dumps(
                    {
                        "request": request.model_dump(mode="json"),
                        "correction": (
                            "The previous response was rejected: "
                            f"{error.detail}. Create a new plan. Every activity "
                            "must use one of the supplied goal IDs, and activity "
                            "minutes must add up exactly to the requested minutes."
                        ),
                    }
                )

        return self._fallback_plan(request)

    @staticmethod
    def _fallback_plan(request: PlanRequest) -> PlanResponse:
        goal = request.goals[0]
        description = goal.description or goal.title
        instructions = (
            f"Spend {request.minutes} minutes making offline progress on "
            f"{description}. Stop when the time is up and note where to begin next."
        )

        return PlanResponse(
            title=f"Time for {goal.title}"[:120],
            activities=[
                Activity(
                    goal_id=goal.id,
                    title=goal.title[:120],
                    minutes=request.minutes,
                    instructions=instructions[:2_000],
                )
            ],
            motivation="A small, focused session is still meaningful progress.",
        )

    @staticmethod
    def _validate_plan(request: PlanRequest, plan: PlanResponse) -> None:
        total_minutes = sum(activity.minutes for activity in plan.activities)
        if total_minutes != request.minutes:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Gemma returned a plan whose activities do not match "
                    "the requested duration"
                ),
            )

        goal_ids = {goal.id for goal in request.goals}
        if any(
            activity.goal_id is not None and activity.goal_id not in goal_ids
            for activity in plan.activities
        ):
            raise HTTPException(
                status_code=502,
                detail="Gemma referenced a goal that was not supplied",
            )
