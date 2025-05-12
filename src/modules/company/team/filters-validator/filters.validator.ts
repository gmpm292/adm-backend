import { IsNumberString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class TeamsFiltersValidator extends BaseFiltersValidator {
  @IsNumberString()
  'user.departmentId': string;

  @IsNumberString()
  'user.department.id': string;

  @IsNumberString()
  departmentId: string;

  @IsNumberString()
  'department.id': string;
}
