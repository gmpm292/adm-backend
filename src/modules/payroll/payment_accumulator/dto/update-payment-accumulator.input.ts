import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentAccumulatorInput } from './create-payment-accumulator.input';

export class UpdatePaymentAccumulatorInput extends PartialType(
  CreatePaymentAccumulatorInput,
) {
  id: number;
}
