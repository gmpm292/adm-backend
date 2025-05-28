import { IsBooleanString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class CurrencyFiltersValidator extends BaseFiltersValidator {
  @IsBooleanString()
  isActive: string;
}
