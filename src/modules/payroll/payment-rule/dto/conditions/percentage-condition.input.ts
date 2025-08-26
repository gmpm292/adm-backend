import { IsNumber } from 'class-validator';

export class PercentageConditionInput {
  @IsNumber()
  percentage: number;
}
