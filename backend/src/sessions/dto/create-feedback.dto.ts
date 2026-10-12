import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const DIFFICULTY_LEVELS = ['easy', 'okay', 'hard'] as const;

export class CreateFeedbackDto {
  @IsBoolean()
  completed: boolean;

  @IsOptional()
  @IsIn(DIFFICULTY_LEVELS)
  difficulty?: (typeof DIFFICULTY_LEVELS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}
