import { IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class InventoryMovementFiltersValidator extends BaseFiltersValidator {
  @IsString()
  'product.name': string;

  @IsString()
  'user.name': string;

  @IsString()
  reason: string;
}
