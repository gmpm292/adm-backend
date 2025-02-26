import { IsBooleanString, IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../core/filters-validator/base-filters.validator';

export class UserFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  role: string;

  @IsString()
  email: string;

  @IsString()
  mobile: string;

  @IsBooleanString()
  enabled: string;

  @IsNumberString()
  'office.id': string;

  @IsNumberString()
  'department.id': string;

  @IsNumberString()
  'team.id': string;
}
