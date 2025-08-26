import { IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class CategoryFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  description: string;
}
