import { IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class BusinessFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  taxId: string;

  @IsString()
  contactEmail: string;
}
