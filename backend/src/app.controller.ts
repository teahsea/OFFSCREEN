import { Controller, Get } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private readonly db: DatabaseService) {}

  @Get('health')
  async health() {
    await sql`SELECT 1`.execute(this.db);

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
