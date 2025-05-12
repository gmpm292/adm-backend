import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ScopedAccessEnum } from '../../../../../core/enums/scoped-access.enum';

export class PriceRangeConditionInput {
  @IsNumber()
  min: number;

  @IsNumber()
  @IsOptional()
  max?: number | null;

  @IsString()
  @MaxLength(3)
  @MinLength(3)
  currency: string;

  @IsNumber()
  amount: number;

  @IsEnum(ScopedAccessEnum)
  scope: ScopedAccessEnum;
}
