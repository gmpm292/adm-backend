import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleInput } from './create-sale.input';
import { IsNumber } from 'class-validator';

export class UpdateSaleInput extends PartialType(CreateSaleInput) {
  @IsNumber()
  id: number;
}
