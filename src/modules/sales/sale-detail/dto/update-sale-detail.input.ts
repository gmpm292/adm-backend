import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleDetailInput } from './create-sale-detail.input';
import { IsNumber } from 'class-validator';

export class UpdateSaleDetailInput extends PartialType(CreateSaleDetailInput) {
  @IsNumber()
  id: number;
}
