import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentAccumulatorInput {
  @IsPositive()
  @IsInt()
  workerId: number;

  @IsPositive()
  @IsInt()
  paymentRuleId: number;

  @IsPositive()
  @IsInt()
  payrollPeriodId: number;

  @IsOptional()
  @IsInt()
  productCounter?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  salesTotal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  accumulatedAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  accumulatedCurrency?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: any;
}
