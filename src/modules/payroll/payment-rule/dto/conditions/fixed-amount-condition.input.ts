import { IsNumber, IsEnum } from 'class-validator';
import { ScopedAccessEnum } from '../../../../../core/enums/scoped-access.enum';

export class FixedAmountConditionInput {
  @IsNumber()
  amount: number;

  @IsEnum(ScopedAccessEnum)
  scope: ScopedAccessEnum;
}
