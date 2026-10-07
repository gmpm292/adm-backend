import { IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class WorkerFiltersValidator extends BaseFiltersValidator {
  @IsString()
  tempFirstName: string;

  @IsString()
  tempLastName: string;

  @IsString()
  tempEmail: string;

  @IsString()
  tempPhone: string;

  @IsString()
  workerType: string;

  @IsNumberString()
  baseSalary: string;

  @IsString()
  'user.name': string;

  @IsString()
  'user.lastName': string;

  @IsString()
  'user.email': string;

  @IsNumberString()
  'user.id': string;

  @IsString()
  'office.name': string;

  @IsNumberString()
  'office.id': string;

  @IsString()
  'business.name': string;

  @IsNumberString()
  'business.id': string;

  @IsString()
  'paymentRule.name': string;
}
