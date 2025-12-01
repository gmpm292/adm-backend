import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsJSON,
  IsDate,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';
import { Type } from 'class-transformer';

export class CreateSaleInput extends CreateSecurityBaseInput {
  @IsNumber()
  salesWorkerId: number;

  @IsNumber()
  @IsOptional()
  customerId?: number;

  // @IsNumber()
  // totalAmount: number;

  // @IsDate()
  // effectiveDate?: Date;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsJSON()
  paymentDetails?: Record<string, unknown>;

  @IsOptional()
  invoiceNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleDetailInput)
  details: SaleDetailInput[];
}

export class SaleDetailInput {
  @IsNumber()
  productId: number;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  publicistIds?: number[];
}
