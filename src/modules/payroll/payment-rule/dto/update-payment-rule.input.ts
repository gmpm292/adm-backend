import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentRuleInput } from './create-payment-rule.input';
import { IsInt } from 'class-validator';

export class UpdatePaymentRuleInput extends PartialType(
  CreatePaymentRuleInput,
) {
  @IsInt()
  id: number;
}
