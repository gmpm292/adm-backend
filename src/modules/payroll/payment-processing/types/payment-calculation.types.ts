import { EntityManager } from 'typeorm';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Sale } from '../../../sales/sale/entities/sale.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { PaymentAccumulator } from '../../payment_accumulator/entities/payment_accumulator.entity';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';
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

export interface PeriodBatchCalculationResult {
  workerPayments: Array<{
    workerId: number;
    workerName: string;
    amount: number;
    currency: string;
    calculationDetails: any;
  }>;
  totalAmount: number;
  totalWorkers: number;
}
