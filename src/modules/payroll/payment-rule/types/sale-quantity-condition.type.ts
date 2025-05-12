import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

export class SaleQuantityCondition {
  minProducts: number;
  ratePerProduct: number;
  scope: ScopedAccessEnum;
}
