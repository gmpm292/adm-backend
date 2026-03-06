import { IsNumberString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class WorkerPaymentFiltersValidator extends BaseFiltersValidator {
  @IsNumberString()
  payrollPeriod: number;
}
