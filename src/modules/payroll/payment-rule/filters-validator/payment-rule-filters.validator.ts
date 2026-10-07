import { IsBooleanString, IsIn, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { PaymentType } from '../enums/payment-type.enum';
import { WorkerType } from '../../worker/enums/worker-type.enum';

export class PaymentRuleFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsIn(Object.values(PaymentType))
  paymentType: string;

  @IsIn(Object.values(WorkerType))
  workerType: string;

  @IsString()
  paymentCurrency: string;

  @IsBooleanString()
  isActive: string;

  @IsString()
  'product.name': string;

  @IsString()
  'category.name': string;
}
