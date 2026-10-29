import { IsDateString, IsIn, IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { WorkerType } from '../../worker/enums/worker-type.enum';
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

  @IsIn(Object.values(WorkerType))
  'worker.workerType': string;

  @IsNumberString()
  'sale.id': string;

  // Pagos de las ventas de un día (informe diario de publicistas)
  @IsDateString()
  'sale.effectiveDate': string;

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
