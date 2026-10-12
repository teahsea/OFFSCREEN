# OFFSCREEN AI service

FastAPI service for structured activity planning with Gemma through Ollama.

## Local setup

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

Ollama must be running separately with the configured model available:

```bash
ollama pull gemma3:4b
```

Run tests with `pytest`.
