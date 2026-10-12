import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { EnergyLevel } from '../../database/database.types';

const ENERGY_LEVELS: EnergyLevel[] = ['low', 'medium', 'high'];

export class CreateSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(180)
  minutes: number;

  @IsIn(ENERGY_LEVELS)
  energy: EnergyLevel;
}
