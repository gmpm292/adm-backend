import { IsDateString, IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class WorkScheduleFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  notes: string;

  @IsString()
  'office.name': string;

  @IsNumberString()
  'office.id': string;

  @IsString()
  'business.name': string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
