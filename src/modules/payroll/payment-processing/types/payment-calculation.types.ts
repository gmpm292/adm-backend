import { EntityManager } from 'typeorm';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Sale } from '../../../sales/sale/entities/sale.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { PaymentAccumulator } from '../../payment_accumulator/entities/payment_accumulator.entity';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';
import { PaymentType } from '../../payment-rule/enums/payment-type.enum';
import { Worker } from '../../worker/entities/worker.entity';

export interface IncrementalCalculationResult {
  incrementalAmount: number;
  newAccumulatorValues: {
    productCounter?: number;
    salesTotal?: number;
    accumulatedAmount?: number;
    accumulatedCurrency?: number;
  };
  breakdown: any;
  distribution?: {
    originalAmount: number;
    distributedAmount: number;
    totalWorkers: number;
    distributionType: 'EQUAL_PER_DAY' | 'EQUAL_PER_SALE';
  };
}

export interface BatchCalculationResult {
  amount: number;
  currency: string;
  paymentConcept: string;
  breakdown: any;
}

export interface PaymentCalculationContext {
  worker: Worker;
  paymentRule: PaymentRule;
  sale?: Sale;
  existingAccumulator?: PaymentAccumulator;
  payrollPeriod?: PayrollPeriod;
  cu?: JWTPayload;
  scopes?: ScopedAccessEnum[];
  manager?: EntityManager;
}

export interface IPaymentProcessor {
  /**
   * Calcula el pago incremental para una venta específica
   */
  calculateIncremental(
    context: PaymentCalculationContext,
  ): Promise<IncrementalCalculationResult>;

  /**
   * Calcula el pago batch para un período completo
   */
  calculateBatch(
    context: PaymentCalculationContext,
  ): Promise<BatchCalculationResult>;

  /**
   * Verifica si este processor puede manejar el tipo de regla
   */
  canHandle(paymentType: PaymentType): boolean;
}
