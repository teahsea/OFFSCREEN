import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
