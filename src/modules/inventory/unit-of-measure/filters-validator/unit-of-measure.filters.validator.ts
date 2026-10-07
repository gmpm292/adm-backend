import { IsString, IsBooleanString, IsIn } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { UNIT_CATEGORIES } from '../unit-categories';

export class UnitOfMeasureFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name?: string;

  @IsString()
  symbol?: string;

  @IsString()
  @IsIn(UNIT_CATEGORIES)
  category?: string;

  @IsBooleanString()
  isActive?: boolean;
}
