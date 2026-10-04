import { IsBooleanString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class SaleFiltersValidator extends BaseFiltersValidator {
  @IsBooleanString()
  hasDelivery: string;

  @IsBooleanString()
  isConfirmed: string;
}
