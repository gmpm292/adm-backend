import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { RollbackSalePaymentsInput } from '../dto/rollback-sale-payments.input';
import { WorkerPayment } from '../../worker-payment/entities/worker-payment.entity';
import { WorkerPaymentService } from '../../worker-payment/services/worker-payment.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { PaymentConcept } from '../../worker-payment/enums/payment-concept.enum';
import { PaymentMethod } from '../../worker-payment/enums/payment-method.enum';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';

@Injectable()
export class PaymentRollbackService {
  constructor(
    private readonly workerPaymentService: WorkerPaymentService,
    private readonly payrollPeriodService: PayrollPeriodService,
  ) {}

  /**
   * MÉTODO PRINCIPAL: Revertir pagos de una venta
   * Para devoluciones, cancelaciones o correcciones
   */
  async rollbackSalePayments(
    input: RollbackSalePaymentsInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    success: boolean;
    originalPaymentsReversed: number;
    compensationPaymentsCreated: number;
    nextPeriodId?: number;
    details: any[];
  }> {
    try {
      console.log(
        `[PaymentRollback] Iniciando reversión de pagos para venta ${input.saleId}`,
      );

      // 1. Buscar todos los pagos de esta venta
      const originalPayments = await this.findPaymentsBySaleId(
        input.saleId,
        cu,
        scopes,
        manager,
      );

      if (originalPayments.length === 0) {
        console.log(
          `[PaymentRollback] No hay pagos para revertir en venta ${input.saleId}`,
        );
        return {
          success: true,
          originalPaymentsReversed: 0,
          compensationPaymentsCreated: 0,
          details: [],
        };
      }

      console.log(
        `[PaymentRollback] Encontrados ${originalPayments.length} pagos para revertir`,
      );

      // 2. Marcar como reversados (soft delete o flag)
      await this.markPaymentsAsReversed(
        originalPayments,
        input.reason,
        cu,
        scopes,
        manager,
      );

      // 3. Si se solicita compensación, crear pagos negativos
      let compensationPayments = 0;
      let nextPeriodId: number | undefined;

      if (input.compensateInNextPeriod && originalPayments.length > 0) {
        const compensationResult = await this.createCompensationPayments(
          originalPayments,
          input.reason,
          input.nextPeriodId,
          cu,
          scopes,
          manager,
        );

        compensationPayments = compensationResult.createdCount;
        nextPeriodId = compensationResult.nextPeriodId;
      }

      console.log(
        `[PaymentRollback] Reversión completada. ` +
          `Reversiones: ${originalPayments.length}, Compensaciones: ${compensationPayments}`,
      );

      return {
        success: true,
        originalPaymentsReversed: originalPayments.length,
        compensationPaymentsCreated: compensationPayments,
        nextPeriodId,
        details: originalPayments.map((p) => ({
          paymentId: p.id,
          workerId: p.worker?.id,
          amount: p.amount,
          currency: p.currency,
          paymentConcept: p.paymentConcept,
          reversed: true,
          compensationCreated: input.compensateInNextPeriod,
        })),
      };
    } catch (error) {
      console.error(
        `[PaymentRollback] Error en reversión de venta ${input.saleId}:`,
        error,
      );

      return {
        success: false,
        originalPaymentsReversed: 0,
        compensationPaymentsCreated: 0,
        details: [
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }
  }

  /**
   * Buscar pagos por ID de venta
   */
  private async findPaymentsBySaleId(
    saleId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment[]> {
    console.log(`[PaymentRollback] Buscando pagos para venta ${saleId}`);

    const result = await this.workerPaymentService.find(
      {
        filters: [
          {
            property: 'sale.id',
            operator: ConditionalOperator.EQUAL,
            value: String(saleId),
          },
        ],
      },
      cu,
      scopes,
      manager,
    );

    const payments = result.data as WorkerPayment[];
    console.log(`[PaymentRollback] Encontrados ${payments.length} pagos`);

    return payments;
  }

  /**
   * Marcar pagos como reversados
   */
  private async markPaymentsAsReversed(
    payments: WorkerPayment[],
    reason: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<void> {
    if (payments.length === 0) return;

    console.log(
      `[PaymentRollback] Marcando ${payments.length} pagos como reversados`,
    );

    for (const payment of payments) {
      try {
        await this.workerPaymentService.update(
          payment.id as number,
          {
            id: payment.id as number,
            breakdown: {
              ...payment.breakdown,
              reversed: true,
              reversalReason: reason,
              reversalDate: new Date(),
            },
            notes:
              `${payment.notes || ''}\nREVERSADO: ${reason} (${new Date().toISOString()})`.trim(),
          },
          cu,
          scopes,
          manager,
        );
      } catch (error) {
        console.error(
          `[PaymentRollback] Error marcando pago ${payment.id}:`,
          error,
        );
      }
    }

    console.log(
      `[PaymentRollback] ${payments.length} pagos marcados como reversados`,
    );
  }

  /**
   * Crear pagos de compensación (descuentos para próximo período)
   */
  private async createCompensationPayments(
    originalPayments: WorkerPayment[],
    reason: string,
    specificNextPeriodId?: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    createdCount: number;
    nextPeriodId?: number;
  }> {
    if (originalPayments.length === 0) {
      return { createdCount: 0 };
    }

    console.log(
      `[PaymentRollback] Creando compensaciones para ${originalPayments.length} pagos`,
    );

    // Determinar el próximo período
    const firstPayment = originalPayments[0];
    let nextPeriodId = specificNextPeriodId;

    if (!nextPeriodId) {
      const nextPeriod = await this.payrollPeriodService.getNextOrCreatePeriod(
        firstPayment.payrollPeriod.id as number,
        cu,
        scopes,
        manager,
      );

      if (!nextPeriod) {
        console.warn(
          '[PaymentRollback] No se encontró próximo período para compensación',
        );
        return { createdCount: 0 };
      }

      nextPeriodId = nextPeriod.id as number;
      console.log(`[PaymentRollback] Período de compensación: ${nextPeriodId}`);
    }

    // Crear pagos negativos de compensación
    let createdCount = 0;

    for (const originalPayment of originalPayments) {
      try {
        await this.workerPaymentService.create(
          {
            workerId: originalPayment.worker.id as number,
            saleId: originalPayment.sale?.id,
            payrollPeriodId: nextPeriodId,
            amount: -originalPayment.amount, // Monto negativo = descuento
            currency: originalPayment.currency,
            paymentConcept: PaymentConcept.DISCOUNT,
            paymentMethod: PaymentMethod.CASH,
            breakdown: {
              ruleName: originalPayment.breakdown?.ruleName || 'Compensación',
              ruleType: originalPayment.breakdown?.ruleType || 'COMPENSATION',
              baseSalary: -originalPayment.amount,
              //compensationFor: originalPayment.id,
              //originalSaleId: originalPayment.sale?.id,
              //reason,
              //originalAmount: originalPayment.amount,
              //compensationAmount: -originalPayment.amount,
              //note: `Compensación por reversión: ${reason}`,
            },
            notes: `Compensación: ${reason}`,
          },
          cu,
          scopes,
          manager,
        );

        createdCount++;
        console.log(
          `[PaymentRollback] Compensación creada para pago ${originalPayment.id}`,
        );
      } catch (error) {
        console.error(
          `[PaymentRollback] Error creando compensación para pago ${originalPayment.id}:`,
          error,
        );
      }
    }

    console.log(`[PaymentRollback] ${createdCount} compensaciones creadas`);

    return {
      createdCount,
      nextPeriodId,
    };
  }
}
