import { IsIn, IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { PaymentConcept } from '../enums/payment-concept.enum';
import { PaymentMethod } from '../enums/payment-method.enum';

export class WorkerPaymentFiltersValidator extends BaseFiltersValidator {
  @IsNumberString()
  'payrollPeriod.id': string;

  @IsString()
  'payrollPeriod.name': string;

  @IsNumberString()
  'worker.id': string;

  @IsString()
  'worker.tempFirstName': string;

  @IsString()
  'worker.tempLastName': string;

  @IsString()
  'user.name': string;

  @IsString()
  'user.lastName': string;

  @IsNumberString()
  'sale.id': string;

  @IsIn(Object.values(PaymentConcept))
  paymentConcept: string;

  @IsIn(Object.values(PaymentMethod))
  paymentMethod: string;

  @IsString()
  currency: string;

  @IsString()
  notes: string;

  @IsString()
  paidDate: string;
}
