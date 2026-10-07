import { IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class ProductFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  'category.name': string;

  @IsNumberString()
  'category.id': string;

  @IsString()
  'unitOfMeasure.name': string;

  @IsNumberString()
  unitOfMeasureId: string;

  @IsNumberString()
  materialCostId: string;

  @IsNumberString()
  costPrice: string;

  @IsNumberString()
  basePrice: string;

  @IsString()
  baseCurrency: string;
}
