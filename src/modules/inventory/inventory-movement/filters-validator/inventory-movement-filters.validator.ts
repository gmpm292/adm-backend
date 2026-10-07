import { IsIn, IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class InventoryMovementFiltersValidator extends BaseFiltersValidator {
  @IsString()
  'product.name': string;

  @IsNumberString()
  'product.id': string;

  @IsString()
  'category.name': string;

  @IsNumberString()
  'inventory.id': string;

  @IsString()
  'inventory.location': string;

  @IsString()
  'office.name': string;

  @IsString()
  'user.name': string;

  @IsIn(['IN', 'OUT'])
  type: string;

  @IsNumberString()
  quantity: string;

  @IsString()
  reason: string;

  @IsString()
  referenceId: string;
}
