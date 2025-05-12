import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkerPaymentInput } from './create-worker-payment.input';
import { IsNumber } from 'class-validator';

export class UpdateWorkerPaymentInput extends PartialType(CreateWorkerPaymentInput) {
  @IsNumber()
  id: number;
}