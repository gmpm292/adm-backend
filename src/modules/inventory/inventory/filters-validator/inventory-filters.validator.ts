import { IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class InventoryFiltersValidator extends BaseFiltersValidator {
  @IsString()
  'product.name': string;

  @IsString()
  location: string;
}
