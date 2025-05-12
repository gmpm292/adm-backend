import {
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsObject,
} from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentConcept } from '../enums/payment-concept.enum';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateWorkerPaymentInput extends CreateSecurityBaseInput {
  @IsNumber()
  workerId: number;

  @IsNumber()
  payrollPeriodId: number;

  @IsNumber()
  amount: number;

  @IsString()
  currency: string; // 'CUP' | 'MLC' | 'USD'

  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsEnum(PaymentConcept)
  paymentConcept: PaymentConcept;

  @IsOptional()
  @IsObject()
  breakdown?: {
    baseSalary?: number;
    commissions?: number;
    bonuses?: number;
    deductions?: number;
  };

  @IsOptional()
  @IsString()
  notes?: string;
}
