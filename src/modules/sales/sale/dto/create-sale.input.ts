import { IsNumber, IsEnum, IsOptional, IsJSON } from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateSaleInput extends CreateSecurityBaseInput {
  @IsNumber()
  salesWorkerId: number;

  @IsNumber()
  @IsOptional()
  customerId?: number;

  @IsNumber()
  totalAmount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsJSON()
  paymentDetails?: Record<string, unknown>;

  @IsOptional()
  invoiceNumber?: string;

  @IsNumber({}, { each: true })
  details: {
    productId: number;
    quantity: number;
  }[];
}
