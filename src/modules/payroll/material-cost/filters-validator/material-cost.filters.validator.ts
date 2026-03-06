import {
  IsString,
  Min,
  IsBooleanString,
  IsNumberString,
} from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class MaterialCostFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name?: string;

  @IsString()
  description?: string;

  @IsNumberString()
  unitOfMeasureId?: number;

  @IsNumberString()
  @Min(0)
  costPrice?: number;

  @IsNumberString()
  currencyId?: number;

  @IsBooleanString()
  isActive?: boolean;
}
