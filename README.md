# OFFSCREEN

OFFSCREEN turns a user's goals, available time, energy, and recent feedback into
a small, achievable offline activity session.

```text
client -> NestJS API -> FastAPI AI service -> Ollama / Gemma
              |
          PostgreSQL
```

NestJS owns application data and business rules. FastAPI owns prompts and
structured model output. Ollama runs Gemma locally.

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker
- Ollama

## Start locally

Start PostgreSQL, then migrate and seed the demo user:

```bash
docker compose up -d postgres
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
```

Install the AI service and pull the configured model:

```bash
cd ../ai-service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
ollama pull gemma3:4b
```

Run each service in a separate terminal:

```bash
cd ai-service
source .venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

```bash
cd backend
npm run start:dev
```

The default ports are `3000` for NestJS, `8001` for FastAPI, `11434` for
Ollama, and `5432` for PostgreSQL.

## Exercise the complete planning path

Create a goal:

```bash
curl -X POST http://localhost:3000/goals \
  -H 'content-type: application/json' \
  -d '{"title":"Read more fiction","category":"reading","description":"Finish the book on my nightstand"}'
```

Ask Gemma for a 20-minute session:

```bash
curl -X POST http://localhost:3000/sessions/plan \
  -H 'content-type: application/json' \
  -d '{"minutes":20,"energy":"medium"}'
```

Use the returned session ID to submit feedback:

```bash
curl -X POST http://localhost:3000/sessions/SESSION_ID/feedback \
  -H 'content-type: application/json' \
  -d '{"completed":true,"difficulty":"okay","notes":"Felt achievable"}'
```

If feedback is saved while AI analysis is unavailable, retry it with:

```bash
curl -X POST http://localhost:3000/sessions/SESSION_ID/feedback/analyze
```

## Verify

```bash
cd backend
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npx eslint "{src,apps,libs,test}/**/*.ts"

cd ../ai-service
.venv/bin/python -m pytest -q
```

The Kysely files in `backend/src/database/migrations/` are the authoritative
schema history. `schema.sql` is only a readable snapshot and must not be used in
place of migrations.

## Current security boundary

The API currently uses the seeded `DEV_USER_ID` for every request. This is for
local demonstration only and is not safe for a public deployment. Configure
`CORS_ORIGIN` with a comma-separated allowlist when using a separate client.
