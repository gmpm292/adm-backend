import { PartialType } from '@nestjs/mapped-types';
import { CreateCurrencyInput } from './create-currency.input';
import { IsInt } from 'class-validator';

export class UpdateCurrencyInput extends PartialType(CreateCurrencyInput) {
  @IsInt()
  id: number;
}
