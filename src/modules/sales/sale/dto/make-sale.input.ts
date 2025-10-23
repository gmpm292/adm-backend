import {
  IsArray,
  IsNumber,
  IsString,
  IsOptional,
  IsDate,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
  IsPositive,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../enums/payment-method.enum';

export class MakeSalePaymentInput {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}

export class MakeSaleInput {
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

  @IsOptional()
  @IsDate()
  customDate?: Date;
}
