import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      preferences JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      context JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      title TEXT,
      requested_minutes INT NOT NULL CHECK (requested_minutes > 0),
      energy TEXT NOT NULL CHECK (energy IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS session_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      instructions TEXT,
      planned_minutes INT NOT NULL CHECK (planned_minutes > 0),
      sort_order INT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL UNIQUE
        REFERENCES sessions(id) ON DELETE CASCADE,
      completed BOOLEAN NOT NULL,
      difficulty TEXT CHECK (difficulty IN ('easy', 'okay', 'hard')),
      notes TEXT,
      ai_analysis JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_goals_user_status
      ON goals(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_created
      ON sessions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_session_activities_session
      ON session_activities(session_id, sort_order);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS session_feedback;
    DROP TABLE IF EXISTS session_activities;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS goals;
    DROP TABLE IF EXISTS users;
  `.execute(db);
}
