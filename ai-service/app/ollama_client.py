import json
import os
from typing import TypeVar

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ValidationError


ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


class OllamaClient:
    def __init__(self) -> None:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        self.chat_url = f"{base_url.rstrip('/')}/api/chat"
        self.model = os.getenv("OLLAMA_MODEL", "gemma3:4b")
        self.timeout = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))

    async def generate(
        self,
        *,
        system_prompt: str,
        user_content: str,
        response_model: type[ResponseModel],
    ) -> ResponseModel:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "format": response_model.model_json_schema(),
            "stream": False,
            "options": {"temperature": 0.2},
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.chat_url, json=payload)
                response.raise_for_status()
        except httpx.TimeoutException as error:
            raise HTTPException(
                status_code=504,
                detail="The local model timed out",
            ) from error
        except httpx.HTTPError as error:
            raise HTTPException(
                status_code=503,
                detail="The local Ollama service is unavailable",
            ) from error

        try:
            content = response.json()["message"]["content"]
            return response_model.model_validate_json(content)
        except (KeyError, TypeError, json.JSONDecodeError, ValidationError) as error:
            raise HTTPException(
                status_code=502,
                detail="Gemma returned an invalid structured response",
            ) from error

