from .models import FeedbackAnalysis, FeedbackRequest
from .ollama_client import OllamaClient


SYSTEM_PROMPT = """You analyze post-session feedback for OFFSCREEN.

Use only the supplied session and feedback. Summarize what happened, identify a
small number of evidence-based observations, and suggest realistic adjustments
for future plans. Never infer a stable preference from a single weak signal.
Give concise, specific encouragement without guilt, streak pressure, or generic
hype. Return only data matching the supplied JSON schema.
"""


class FeedbackAnalyzer:
    def __init__(self) -> None:
        self.ollama = OllamaClient()

    async def analyze(self, request: FeedbackRequest) -> FeedbackAnalysis:
        return await self.ollama.generate(
            system_prompt=SYSTEM_PROMPT,
            user_content=request.model_dump_json(),
            response_model=FeedbackAnalysis,
        )

