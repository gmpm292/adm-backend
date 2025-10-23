import {
  IsArray,
  IsNumber,
  IsString,
  IsOptional,
  ArrayMinSize,
  ValidateNested,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MakeSalePaymentInput } from './make-sale.input';

export class ValidateSalePaymentsInput {
  @IsNumber()
  saleId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MakeSalePaymentInput)
  payments: MakeSalePaymentInput[];

  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;
}
