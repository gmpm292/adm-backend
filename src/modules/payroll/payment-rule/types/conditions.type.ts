import { FixedAmountCondition } from './fixed-amount-condition.type';
import { PercentageCondition } from './percentage-condition.type';
import { PriceRangeCondition } from './price-range-condition.type';
import { SaleQuantityCondition } from './sale-quantity-condition.type';

export class Conditions {
  priceRanges?: PriceRangeCondition[];
  saleQuantity?: SaleQuantityCondition[];
  fixedAmount?: FixedAmountCondition;
  percentage?: PercentageCondition;
}
