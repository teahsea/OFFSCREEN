# OFFSCREEN

OFFSCREEN turns a goal, available time, energy, and recent feedback into a small,
achievable activity away from the screen.

```text
Frontend -> NestJS API -> FastAPI AI service -> Ollama / Gemma
                    |
                PostgreSQL
```

## Services

| Directory | Purpose | Stack | Default port |
| --- | --- | --- | --- |
| [`frontend/`](frontend/) | Goal setup, session planning, timers, and feedback | Next.js, React, Vinext | `3001` |
| [`backend/`](backend/) | API, validation, business rules, and persistence | NestJS, Kysely, PostgreSQL | `3000` |
| [`ai-service/`](ai-service/) | Prompting and structured activity plans | FastAPI, Ollama, Gemma 3 | `8001` |

The backend remains the source of truth. The AI service only generates structured
plans and feedback analysis; it does not access the database directly.

## Run locally

Requirements: Node.js 22+, Python 3.12+, Docker, and
[Ollama](https://ollama.com/).

```bash
# Database
docker compose up -d postgres

# Backend
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run start:dev
```

In a second terminal:

```bash
# AI service
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
ollama pull gemma3:4b
uvicorn app.main:app --reload --port 8001
```

In a third terminal:

```bash
# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev -- --port 3001
```

Open [http://localhost:3001](http://localhost:3001). The API health endpoint is
available at [http://localhost:3000/health](http://localhost:3000/health).

## Verify

```bash
cd frontend && npm run lint && npm test
cd ../backend && npm test -- --runInBand && npm run test:e2e -- --runInBand
cd ../ai-service && .venv/bin/python -m pytest -q
```

## Deployment notes

Deploy the frontend and backend as public web services, FastAPI and Ollama as
private services, and PostgreSQL as a managed database. Configure
`NEXT_PUBLIC_API_URL`, `DATABASE_URL`, `AI_SERVICE_URL`, `OLLAMA_BASE_URL`, and
`CORS_ORIGIN` for the deployed service URLs.

The current `DEV_USER_ID` configuration gives every request the same demo user.
It is suitable for a shared demo only, not for storing private user data.

Database migrations in `backend/src/database/migrations/` are the authoritative
schema history; `schema.sql` is a readable snapshot only.
