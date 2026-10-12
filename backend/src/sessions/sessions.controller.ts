import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsDto } from './dto/list-sessions.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  private readonly userId: string;

  constructor(
    private readonly sessionsService: SessionsService,
    config: ConfigService,
  ) {
    this.userId = config.getOrThrow<string>('DEV_USER_ID');
  }

  @Post('plan')
  plan(@Body() input: CreateSessionDto) {
    return this.sessionsService.plan(this.userId, input);
  }

  @Get()
  findAll(@Query() query: ListSessionsDto) {
    return this.sessionsService.findAll(this.userId, query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) sessionId: string) {
    return this.sessionsService.findOne(this.userId, sessionId);
  }

  @Post(':id/feedback')
  submitFeedback(
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Body() input: CreateFeedbackDto,
  ) {
    return this.sessionsService.submitFeedback(this.userId, sessionId, input);
  }

  @Post(':id/feedback/analyze')
  @HttpCode(HttpStatus.OK)
  retryFeedbackAnalysis(@Param('id', new ParseUUIDPipe()) sessionId: string) {
    return this.sessionsService.retryFeedbackAnalysis(this.userId, sessionId);
  }
}
