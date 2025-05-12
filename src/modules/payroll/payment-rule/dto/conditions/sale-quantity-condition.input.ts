import { IsNumber, IsEnum } from 'class-validator';
import { ScopedAccessEnum } from '../../../../../core/enums/scoped-access.enum';

export class SaleQuantityConditionInput {
  @IsNumber()
  minProducts: number;

  @IsNumber()
  ratePerProduct: number;

  @IsEnum(ScopedAccessEnum)
  scope: ScopedAccessEnum;
}
