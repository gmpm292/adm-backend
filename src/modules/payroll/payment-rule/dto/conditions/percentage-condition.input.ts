import { IsNumber, IsEnum } from 'class-validator';
import { ScopedAccessEnum } from '../../../../../core/enums/scoped-access.enum';

export class PercentageConditionInput {
  @IsNumber()
  percentage: number;

  @IsEnum(ScopedAccessEnum)
  scope: ScopedAccessEnum;
}
