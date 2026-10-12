import 'dotenv/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.types';

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

async function seed() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  });

  try {
    const user = await db
      .insertInto('users')
      .values({
        id: DEV_USER_ID,
        name: 'Local Developer',
        email: 'dev@offscreen.local',
        preferences: JSON.stringify({}),
      })
      .onConflict((conflict) =>
        conflict.column('id').doUpdateSet({
          name: 'Local Developer',
          email: 'dev@offscreen.local',
        }),
      )
      .returning(['id', 'email'])
      .executeTakeFirstOrThrow();

    console.log(`Seeded ${user.email} (${user.id})`);
  } finally {
    await db.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
