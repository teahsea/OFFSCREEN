import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE sessions
      ADD COLUMN motivation TEXT NOT NULL DEFAULT '';

    ALTER TABLE sessions
      ALTER COLUMN motivation DROP DEFAULT;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE sessions
      DROP COLUMN motivation;
  `.execute(db);
}
