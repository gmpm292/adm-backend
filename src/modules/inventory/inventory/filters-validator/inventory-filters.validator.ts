import { IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class InventoryFiltersValidator extends BaseFiltersValidator {
  @IsString()
  'product.name': string;

  @IsNumberString()
  'product.id': string;

  @IsString()
  'category.name': string;

  @IsNumberString()
  'category.id': string;

  @IsString()
  location: string;

  @IsNumberString()
  currentStock: string;

  @IsNumberString()
  minStock: string;

  @IsString()
  'business.name': string;

  @IsString()
  'office.name': string;

  @IsNumberString()
  'office.id': string;

  @IsString()
  'department.name': string;

  @IsString()
  'team.name': string;
}
