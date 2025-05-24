import { IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../core/filters-validator/base-filters.validator';

export class FiltersValidator extends BaseFiltersValidator {
  @IsString()
  type: string;
}
