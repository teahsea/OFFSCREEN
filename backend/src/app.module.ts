import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { GoalsModule } from './goals/goals.module';
import { SessionsModule } from './sessions/sessions.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    GoalsModule,
    SessionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
