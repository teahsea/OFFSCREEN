from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Goal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    description: str | None = None
    category: str
    context: dict[str, Any] = Field(default_factory=dict)


class PlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minutes: int = Field(ge=5, le=180)
    energy: Literal["low", "medium", "high"]
    goals: list[Goal] = Field(min_length=1)
    recent_feedback: list["RecentFeedback"] = Field(
        default_factory=list,
        max_length=5,
    )


class RecentFeedback(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_title: str | None = None
    requested_minutes: int = Field(gt=0)
    energy: Literal["low", "medium", "high"]
    completed: bool
    difficulty: Literal["easy", "okay", "hard"] | None = None
    notes: str | None = None
    ai_analysis: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal_id: str | None = None
    title: str = Field(min_length=1, max_length=120)
    minutes: int = Field(gt=0)
    instructions: str = Field(min_length=1, max_length=2_000)


class PlanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)
    activities: list[Activity] = Field(min_length=1)
    motivation: str = Field(min_length=1, max_length=500)


class FeedbackActivity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    planned_minutes: int = Field(gt=0)
    goal_id: str | None = None


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    session_title: str | None = None
    requested_minutes: int = Field(gt=0)
    energy: Literal["low", "medium", "high"]
    activities: list[FeedbackActivity] = Field(min_length=1)
    completed: bool
    difficulty: Literal["easy", "okay", "hard"] | None = None
    notes: str | None = Field(default=None, max_length=2_000)


class FeedbackAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=500)
    encouragement: str = Field(min_length=1, max_length=500)
    observations: list[str] = Field(min_length=1, max_length=4)
    future_adjustments: list[str] = Field(min_length=1, max_length=4)
