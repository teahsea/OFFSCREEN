import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SessionStatus } from '../../database/database.types';

const SESSION_STATUSES: SessionStatus[] = [
  'planned',
  'in_progress',
  'completed',
  'skipped',
];

export class ListSessionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsIn(SESSION_STATUSES)
  status?: SessionStatus;
}
