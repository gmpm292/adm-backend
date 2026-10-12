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

/** `breakdown.ruleType` de los descuentos que anulan un pago revertido */
const COMPENSATION = 'COMPENSATION';

/**
 * Deshace las comisiones de una venta devuelta. Lo llama `SaleService` al
 * devolver (en la misma transacción) y también está expuesto en GraphQL.
 */
@Injectable()
export class PaymentRollbackService {
  constructor(
    private readonly workerPaymentService: WorkerPaymentService,
    private readonly payrollPeriodService: PayrollPeriodService,
  ) {}

  /**
   * Revierte los pagos de la venta que no lo estén ya (las compensaciones no
   * se revierten): los pendientes se eliminan; los pagados se marcan
   * `reversed` en `breakdown` y, con `compensateInNextPeriod` (por defecto),
   * se descuentan con una compensación. Todo o nada: si algo falla lanza, y
   * la transacción (la de `refundSale` o una propia) se deshace.
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
    if (!manager) {
      return this.workerPaymentService
        .getRepository()
        .manager.transaction((txManager) =>
          this.rollbackSalePayments(input, cu, scopes, txManager),
        );
    }

    console.log(
      `[PaymentRollback] Iniciando reversión de pagos para venta ${input.saleId}`,
    );

    // 1. Pagos de esta venta, sin sus compensaciones ni los ya revertidos
    const originalPayments = (
      await this.findPaymentsBySaleId(input.saleId, cu, scopes, manager)
    ).filter((p) => p.breakdown?.ruleType !== COMPENSATION);
    const activePayments = originalPayments.filter(
      (p) => !p.breakdown?.reversed,
    );

    if (activePayments.length === 0) {
      console.log(
        `[PaymentRollback] No hay pagos activos para revertir en venta ${input.saleId}`,
      );
      return {
        success: true,
        originalPaymentsReversed: 0,
        compensationPaymentsCreated: 0,
        details: originalPayments.map((p) => ({
          paymentId: p.id,
          workerId: p.worker?.id,
          amount: p.amount,
          status: 'ALREADY_REVERSED',
        })),
      };
    }

    // 2. SEPARAR PAGOS POR ESTADO
    const paidPayments = activePayments.filter((p) => !!p.paidDate);
    const unpaidPayments = activePayments.filter((p) => !p.paidDate);

    console.log(
      `[PaymentRollback] Pagos ya efectuados: ${paidPayments.length}, ` +
        `Pagos no efectuados: ${unpaidPayments.length}`,
    );

    // 3. ELIMINAR PAGOS NO EFECTUADOS (nunca se pagaron)
    if (unpaidPayments.length > 0) {
      await this.workerPaymentService.remove(
        unpaidPayments
          .map((e) => e.id)
          .filter((id): id is number => id !== undefined),
        cu,
        scopes,
        manager,
      );
    }

    // 4. MARCAR PAGOS EFECTUADOS COMO REVERSADOS
    await this.markPaymentsAsReversed(paidPayments, input.reason, manager);

    // 5. COMPENSAR LOS PAGOS EFECTUADOS (si se solicita)
    let compensationPayments = 0;
    let nextPeriodId: number | undefined;
    const compensateInNextPeriod = input.compensateInNextPeriod ?? true;

    if (compensateInNextPeriod && paidPayments.length > 0) {
      const compensationResult = await this.createCompensationPayments(
        paidPayments,
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
        `Eliminados: ${unpaidPayments.length}, ` +
        `Reversiones: ${paidPayments.length}, ` +
        `Compensaciones: ${compensationPayments}`,
    );

    return {
      success: true,
      originalPaymentsReversed: paidPayments.length, // Solo los efectuados se consideran "reversados"
      compensationPaymentsCreated: compensationPayments,
      nextPeriodId,
      details: activePayments.map((p) => ({
        paymentId: p.id,
        workerId: p.worker?.id,
        amount: p.amount,
        currency: p.currency,
        paymentConcept: p.paymentConcept,
        paidDate: p.paidDate,
        action: p.paidDate ? 'REVERSED' : 'DELETED',
        compensationCreated: compensateInNextPeriod && !!p.paidDate,
      })),
    };
  }

  /** Todos los pagos vinculados a la venta (comisiones y compensaciones). */
  private async findPaymentsBySaleId(
    saleId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment[]> {
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

    return result.data as WorkerPayment[];
  }

  /**
   * Anota la reversión en `breakdown` y `notes` sin tocar el importe. Va
   * directo a la tabla porque el pago puede ser de un período cerrado (que
   * `WorkerPaymentService.update` no deja tocar): solo es una anotación, y
   * evita que una segunda devolución lo vuelva a compensar.
   */
  private async markPaymentsAsReversed(
    payments: WorkerPayment[],
    reason: string,
    manager: EntityManager,
  ): Promise<void> {
    const repository = manager.getRepository(WorkerPayment);
    for (const payment of payments) {
      await repository.update(payment.id as number, {
        breakdown: {
          ...payment.breakdown,
          reversed: true,
          reversalReason: reason,
          reversalDate: new Date(),
        } as WorkerPayment['breakdown'],
        notes:
          `${payment.notes || ''}\nREVERSADO: ${reason} (${new Date().toISOString()})`.trim(),
      });
    }
  }

  /**
   * Crea un descuento (importe negativo, `ruleType: 'COMPENSATION'`) por cada
   * pago ya hecho, en `specificNextPeriodId` o en el período de su empresa
   * que contiene hoy (creándolo si no existe).
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
    let nextPeriodId = specificNextPeriodId;
    const periodByBusiness = new Map<number | undefined, number>();

    for (const originalPayment of originalPayments) {
      const businessId = originalPayment.business?.id ?? cu?.businessId;
      let periodId = specificNextPeriodId ?? periodByBusiness.get(businessId);
      if (!periodId) {
        const period = await this.payrollPeriodService.getCurrentOrCreatePeriod(
          new Date(),
          cu,
          scopes,
          manager,
          businessId,
        );
        periodId = period.id as number;
        periodByBusiness.set(businessId, periodId);
      }
      nextPeriodId = periodId;

      await this.workerPaymentService.createCompensation(
        {
          workerId: originalPayment.worker.id as number,
          saleId: originalPayment.sale?.id,
          payrollPeriodId: periodId,
          amount: -originalPayment.amount,
          currency: originalPayment.currency,
          exchangeRate: originalPayment.exchangeRate,
          paymentConcept: PaymentConcept.DISCOUNT,
          paymentMethod: PaymentMethod.CASH,
          breakdown: {
            ruleName: originalPayment.breakdown?.ruleName || 'Compensación',
            ruleType: COMPENSATION,
            compensationFor: originalPayment.id,
            reversalReason: reason,
          },
          notes: `Compensación del pago #${originalPayment.id}: ${reason}`,
        },
        cu,
        scopes,
        manager,
      );
    }

    console.log(
      `[PaymentRollback] ${originalPayments.length} compensaciones creadas`,
    );

    return {
      createdCount: originalPayments.length,
      nextPeriodId,
    };
  }
}
