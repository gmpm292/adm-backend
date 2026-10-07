import { IsBooleanString, IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class MaterialCostFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name?: string;

  @IsString()
  description?: string;

  @IsNumberString()
  'unitOfMeasure.id'?: string;

  @IsString()
  'unitOfMeasure.name'?: string;

  @IsNumberString()
  costPrice?: string;

  @IsString()
  'currency.code'?: string;

  @IsString()
  'business.name'?: string;

  @IsBooleanString()
  isActive?: string;
}
