import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

export class PriceRangeCondition {
  min: number;
  max: number | null; // null = sin límite superior
  currency: string;
  amount: number;
  scope: ScopedAccessEnum;
}
