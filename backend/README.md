# OFFSCREEN backend

NestJS API for goals, AI-generated sessions, session history, and feedback.
PostgreSQL access is implemented with Kysely; the FastAPI AI service remains
stateless.

## Commands

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run start:dev
```

Quality checks:

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npx eslint "{src,apps,libs,test}/**/*.ts"
```

The end-to-end suite requires the local PostgreSQL container, migrations, and
seed from the root project README. It replaces the AI client with a deterministic
test double, so it does not require Ollama.

`CORS_ORIGIN` accepts one origin or a comma-separated list. Authentication is
currently an explicit local-demo shortcut: every request uses `DEV_USER_ID`.
Do not expose this API publicly until request-level authentication is added.
