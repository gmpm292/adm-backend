import { IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class InventoryFiltersValidator extends BaseFiltersValidator {
  @IsString()
  'product.name': string;

  @IsString()
  location: string;

  @IsNumberString()
  currentStock: string;

  @IsNumberString()
  'office.id': string;

  @IsNumberString()
  'category.id': string;
}
