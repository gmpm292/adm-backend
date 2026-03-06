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

  @IsOptional()
  @IsNumber()
  paymentRuleId?: number;

  @IsOptional()
  @IsNumber()
  saleId?: number;

  @IsOptional()
  paidDate?: Date;

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
  paymentConcept: PaymentConcept; // Mantenemos paymentConcept como en la entidad

  @IsOptional()
  @IsObject()
  breakdown?: {
    ruleName?: string;
    ruleType?: string;
    baseSalary?: number;
    commissions?: number;
    bonuses?: number;
    deductions?: number;
    roleInSale?: 'MAIN_SELLER' | 'PUBLICIST' | 'OTHER';
    saleId?: number;
    saleDate?: Date;
    saleAmount?: number;
    ruleId?: number;
    distributeProfits?: boolean;
    accumulatorId?: number;
    calculationSummary?: any;
    reversed?: boolean;
    reversalReason?: string;
    reversalDate?: Date;
  };

  @IsOptional()
  @IsString()
  notes?: string;
}
