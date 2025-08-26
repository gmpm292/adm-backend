import { IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class ProductFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  'category.name': string;

  @IsString()
  unitOfMeasure: string;
}
