import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { PriceRangeConditionInput } from './price-range-condition.input';
import { SaleQuantityConditionInput } from './sale-quantity-condition.input';
import { FixedAmountConditionInput } from './fixed-amount-condition.input';
import { PercentageConditionInput } from './percentage-condition.input';
import { Type } from 'class-transformer';

export class ConditionsInput {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceRangeConditionInput)
  priceRanges?: PriceRangeConditionInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleQuantityConditionInput)
  saleQuantity?: SaleQuantityConditionInput[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FixedAmountConditionInput)
  fixedAmount?: FixedAmountConditionInput;

  @IsOptional()
  @ValidateNested()
  @Type(() => PercentageConditionInput)
  percentage?: PercentageConditionInput;
}
