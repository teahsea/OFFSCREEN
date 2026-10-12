import json

from fastapi import FastAPI


app = FastAPI()


@app.post("/api/chat")
async def chat(payload: dict) -> dict:
    request = json.loads(payload["messages"][1]["content"])

    if "completed" in request:
        completed = request["completed"]
        analysis = {
            "summary": (
                "You completed the planned offline session."
                if completed
                else "The planned session was interrupted before completion."
            ),
            "encouragement": (
                "You followed through on the time you set aside."
                if completed
                else "Recording what got in the way makes the next plan more useful."
            ),
            "observations": [
                f"The session was rated {request.get('difficulty') or 'without difficulty'}."
            ],
            "future_adjustments": [
                "Use the interruption as context, not as a permanent preference."
            ],
        }
        return {"message": {"content": json.dumps(analysis)}}

    goal = request["goals"][0]
    feedback_count = len(request.get("recent_feedback", []))
    plan = {
        "title": f"A focused session informed by {feedback_count} check-ins",
        "activities": [
            {
                "goal_id": goal["id"],
                "title": f"Make progress on {goal['title']}",
                "minutes": request["minutes"],
                "instructions": "Put the phone away and focus on this goal.",
            }
        ],
        "motivation": "A focused block is meaningful progress.",
    }
    return {"message": {"content": json.dumps(plan)}}
