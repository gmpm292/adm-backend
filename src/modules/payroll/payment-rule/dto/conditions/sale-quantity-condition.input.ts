import { IsNumber } from 'class-validator';

export class SaleQuantityConditionInput {
  @IsNumber()
  minProducts: number;

  @IsNumber()
  ratePerProduct: number;
}
