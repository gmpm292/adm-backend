
import { IsBooleanString } from 'class-validator';
import { BaseFiltersValidator } from '../../../core/filters-validator/base-filters.validator';

export class clientNotificationsFiltersValidator extends BaseFiltersValidator {
  @IsBooleanString()
  read: string;
}
