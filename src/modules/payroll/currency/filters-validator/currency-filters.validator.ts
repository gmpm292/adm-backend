import { IsBooleanString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class CurrencyFiltersValidator extends BaseFiltersValidator {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  symbol: string;

  @IsBooleanString()
  isActive: string;
}
