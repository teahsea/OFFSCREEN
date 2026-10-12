import { Module } from '@nestjs/common';
import { AiPlannerClient } from '../ai/ai-planner.client';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  providers: [AiPlannerClient, SessionsService],
})
export class SessionsModule {}
