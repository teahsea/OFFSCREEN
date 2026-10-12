import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  private readonly userId: string;

  constructor(
    private readonly goalsService: GoalsService,
    config: ConfigService,
  ) {
    this.userId = config.getOrThrow<string>('DEV_USER_ID');
  }

  @Post()
  create(@Body() input: CreateGoalDto) {
    return this.goalsService.create(this.userId, input);
  }

  @Get()
  findActive() {
    return this.goalsService.findActive(this.userId);
  }
}
