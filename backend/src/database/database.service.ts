import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.types';

@Injectable()
export class DatabaseService
  extends Kysely<Database>
  implements OnModuleDestroy
{
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');

    super({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString,
          max: 10,
        }),
      }),
    });
  }

  async onModuleDestroy() {
    await this.destroy();
  }
}
