import 'dotenv/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
} from 'kysely';
import { Pool } from 'pg';

async function migrate() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  });
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  try {
    const direction = process.argv[2] ?? 'latest';
    const result =
      direction === 'down'
        ? await migrator.migrateDown()
        : await migrator.migrateToLatest();

    for (const migration of result.results ?? []) {
      console.log(`${migration.status}: ${migration.migrationName}`);
    }

    if (result.error) {
      throw result.error;
    }
  } finally {
    await db.destroy();
  }
}

migrate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
