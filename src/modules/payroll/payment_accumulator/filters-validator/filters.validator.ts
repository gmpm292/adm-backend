import { IsNumberString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class PaymentAccumulatorsFiltersValidator extends BaseFiltersValidator {
  @IsNumberString()
  'worker.id': string;

  @IsNumberString()
  'paymentRule.id': string;

  @IsNumberString()
  'payrollPeriod.id': string;

  @IsNumberString()
  workerId: string;

  @IsNumberString()
  paymentRuleId: string;

  @IsNumberString()
  payrollPeriodId: string;

  @IsNumberString()
  productCounter: string;

  @IsNumberString()
  salesTotal: string;

  @IsNumberString()
  accumulatedAmount: string;

  @IsNumberString()
  accumulatedCurrency: string;
}
