import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateGoalDto } from './dto/create-goal.dto';

@Injectable()
export class GoalsService {
  constructor(private readonly db: DatabaseService) {}

  create(userId: string, input: CreateGoalDto) {
    return this.db
      .insertInto('goals')
      .values({
        user_id: userId,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        context: JSON.stringify(input.context ?? {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  findActive(userId: string) {
    return this.db
      .selectFrom('goals')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .orderBy('created_at', 'desc')
      .execute();
  }
}
