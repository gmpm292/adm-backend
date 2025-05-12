import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerInput } from './create-customer.input';
import { IsNumber } from 'class-validator';

export class UpdateCustomerInput extends PartialType(CreateCustomerInput) {
  @IsNumber()
  id: number;
}
