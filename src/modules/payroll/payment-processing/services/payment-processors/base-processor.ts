import { Injectable } from '@nestjs/common';

import { Worker } from '../../../worker/entities/worker.entity';

import { PayrollPeriod } from '../../../payroll-period/entities/payroll-period.entity';

import { PaymentType } from '../../../payment-rule/enums/payment-type.enum';
import {
  IPaymentProcessor,
  PaymentCalculationContext,
  IncrementalCalculationResult,
  BatchCalculationResult,
} from '../../types/payment-calculation.types';
import { Sale } from '../../../../sales/sale/entities/sale.entity';
import { PaymentRule } from '../../../payment-rule/entities/payment-rule.entity';
import { JWTPayload } from '../../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../../core/enums/scoped-access.enum';
import { EntityManager } from 'typeorm';
import { RealTimeCalculationResult } from '../../types/real-time-calculation.types';

@Injectable()
export abstract class BasePaymentProcessor implements IPaymentProcessor {
  protected abstract readonly supportedPaymentType: PaymentType;

  abstract calculateIncremental(
    context: PaymentCalculationContext,
  ): Promise<IncrementalCalculationResult>;

  abstract calculateBatch(
    context: PaymentCalculationContext,
  ): Promise<BatchCalculationResult>;

  canHandle(paymentType: PaymentType): boolean {
    return paymentType === this.supportedPaymentType;
  }

  /**
   * Métodos helper comunes a todos los processors
   */

  protected validateContext(context: PaymentCalculationContext): void {
    if (!context.worker) {
      throw new Error('Worker is required');
    }

    if (!context.paymentRule) {
      throw new Error('PaymentRule is required');
    }

    if (context.paymentRule.paymentType !== this.supportedPaymentType) {
      throw new Error(
        `This processor only handles ${this.supportedPaymentType} rules`,
      );
    }
  }

  protected validateSaleForIncremental(sale: Sale): void {
    if (!sale) {
      throw new Error('Sale is required for incremental calculation');
    }

    if (!sale.isConfirmed) {
      throw new Error('Sale must be confirmed for payment calculation');
    }

    if (!sale.effectiveDate) {
      throw new Error('Sale effectiveDate is required');
    }
  }

  protected validatePayrollPeriodForBatch(period: PayrollPeriod): void {
    if (!period) {
      throw new Error('PayrollPeriod is required for batch calculation');
    }

    if (!period.startDate || !period.endDate) {
      throw new Error('PayrollPeriod must have startDate and endDate');
    }
  }

  protected getWorkerName(worker: Worker): string {
    return (
      worker.user?.fullName ||
      `${worker.tempFirstName || ''} ${worker.tempLastName || ''}`.trim() ||
      `Worker #${worker.id}`
    );
  }

  protected createBaseBreakdown(context: PaymentCalculationContext): any {
    return {
      ruleId: context.paymentRule.id,
      ruleName: context.paymentRule.name,
      ruleType: context.paymentRule.paymentType,
      scope: context.paymentRule.scope,
      workerId: context.worker.id,
      workerName: this.getWorkerName(context.worker),
      calculationDate: new Date().toISOString(),
      productId: context.paymentRule.product?.id,
      productName: context.paymentRule.product?.name,
      categoryId: context.paymentRule.category?.id,
      categoryName: context.paymentRule.category?.name,
      distributeProfits: context.paymentRule.distributeProfits,
    };
  }

  protected shouldDistributeProfits(
    context: PaymentCalculationContext,
  ): boolean {
    return context.paymentRule.distributeProfits === true;
  }

  /**
   * Calcula pagos en tiempo real para una venta específica
   * Este método maneja TODO: cálculo + distribución + acumuladores
   */
  abstract realTimeCalculate(
    rule: PaymentRule,
    sale: Sale,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<RealTimeCalculationResult>;
}
