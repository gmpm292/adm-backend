import { IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class CustomerFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  lastName?: string;

  @IsString()
  fullName?: string;

  @IsString()
  ci?: string;

  @IsString()
  email?: string;

  @IsString()
  phone?: string;
}
