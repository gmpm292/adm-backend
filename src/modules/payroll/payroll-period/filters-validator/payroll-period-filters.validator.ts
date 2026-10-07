import { IsBooleanString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class PayrollPeriodFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsBooleanString()
  isClosed: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsString()
  'business.name': string;
}
