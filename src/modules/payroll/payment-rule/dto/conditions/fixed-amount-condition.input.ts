import { IsNumber } from 'class-validator';

export class FixedAmountConditionInput {
  @IsNumber()
  amount: number;
}
