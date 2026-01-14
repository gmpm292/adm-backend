import { Injectable, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { ProcessPaymentsInput } from '../dto/process-payments.input';

import { RealTimePaymentProcessor } from './real-time-payment.service';
import { PaymentBatchService } from './payment-batch.service';
import { ProcessSalePaymentInput } from '../dto/process-sale-payment.input';
import { RollbackSalePaymentsInput } from '../dto/rollback-sale-payments.input';

@Injectable()
export class PaymentProcessingService {
  constructor(
    @Inject(RealTimePaymentProcessor)
    private readonly realTimeProcessor: RealTimePaymentProcessor,

    @Inject(PaymentBatchService)
    private readonly batchService: PaymentBatchService,
  ) {}

  /**
   * MÉTODO PRINCIPAL: Procesar pagos de una venta en tiempo real
   * Este es el método que llamará SaleService cuando se confirme una venta
   */
  async processSalePayment(
    input: ProcessSalePaymentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    success: boolean;
    paymentsCreated: number;
    totalAmount: number;
    saleId: number;
    details: any[];
  }> {
    try {
      console.log(
        `[PaymentProcessing] Processing payment for sale ${input.saleId}`,
      );

      const result = await this.realTimeProcessor.processSale(
        input.saleId,
        cu,
        scopes,
        manager,
      );

      console.log(
        `[PaymentProcessing] Sale ${input.saleId} processed successfully. ` +
          `Created ${result.paymentsCreated} payments, total: ${result.totalAmount}`,
      );

      return {
        success: true,
        paymentsCreated: result.paymentsCreated,
        totalAmount: result.totalAmount,
        saleId: input.saleId,
        details: result.details,
      };
    } catch (error) {
      console.error(
        `[PaymentProcessing] Failed to process sale ${input.saleId}:`,
        error,
      );

      return {
        success: false,
        paymentsCreated: 0,
        totalAmount: 0,
        saleId: input.saleId,
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
   * MÉTODO BATCH: Procesar pagos de un período completo
   * Para reglas FIXED_AMOUNT u otras asociadas al periodo completo.
   */
  async processBatchPayments(
    input: ProcessPaymentsInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingSummary> {
    try {
      console.log(
        `[PaymentProcessing] Starting batch processing for period ${input.payrollPeriodId}`,
      );

      const result = await this.batchService.processPeriodPayments(
        input,
        cu,
        scopes,
        manager,
      );

      console.log(
        `[PaymentProcessing] Batch processing completed. ` +
          `Success: ${result.successCount}, Errors: ${result.errorCount}`,
      );

      return result;
    } catch (error) {
      console.error('[PaymentProcessing] Batch processing failed:', error);

      return {
        data: [],
        totalCount: 0,
        successCount: 0,
        errorCount: 1,
      };
    }
  }

  // Agregar método para procesamiento fixed amount
  async processPayments(
    input: ProcessPaymentsInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingSummary> {
    console.log(
      `[PaymentProcessing] Procesando pagos batch para período ${input.payrollPeriodId}`,
    );

    try {
      const result = await this.batchService.processPeriodPayments(
        input,
        cu,
        scopes,
        manager,
      );

      console.log(
        `[PaymentProcessing] Procesamiento batch completado. ` +
          `Total: ${result.totalCount}, Éxitos: ${result.successCount}, Errores: ${result.errorCount}`,
      );

      return result;
    } catch (error) {
      console.error('[PaymentProcessing] Error en procesamiento batch:', error);

      return {
        data: [
          {
            workerId: 0,
            workerName: 'Sistema',
            amount: 0,
            currency: 'CUP',
            paymentConcept: 'ERROR',
            status: 'ERROR',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            errors: [error.message],
            details: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              error: error.message,
              payrollPeriodId: input.payrollPeriodId,
            },
          },
        ],
        totalCount: 1,
        successCount: 0,
        errorCount: 1,
      };
    }
  }

  /**
   * REVERTIR PAGOS: Para devoluciones de venta
   * Crea pagos negativos (descuentos) para el próximo período
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
        `[PaymentProcessing] Rolling back payments for sale ${input.saleId}`,
      );

      // 1. Buscar todos los pagos de esta venta
      const reversedPayments = await this.batchService.findPaymentsBySaleId(
        input.saleId,
        cu,
        scopes,
        manager,
      );

      // 2. Marcar como reversados (soft delete o flag)
      await this.batchService.markPaymentsAsReversed(
        reversedPayments.map((p) => p.id as number),
        input.reason,
        cu,
        scopes,
        manager,
      );

      // 3. Si los pagos ya fueron efectuados, crear compensaciones
      let compensationPayments = 0;
      let nextPeriodId: number | undefined;

      if (input.compensateInNextPeriod && reversedPayments.length > 0) {
        const compensationResult =
          await this.batchService.createCompensationPayments(
            reversedPayments,
            input.reason,
            cu,
            scopes,
            manager,
          );

        compensationPayments = compensationResult.createdCount;
        nextPeriodId = compensationResult.nextPeriodId;
      }

      console.log(
        `[PaymentProcessing] Rollback completed. ` +
          `Reversed: ${reversedPayments.length}, Compensations: ${compensationPayments}`,
      );

      return {
        success: true,
        originalPaymentsReversed: reversedPayments.length,
        compensationPaymentsCreated: compensationPayments,
        nextPeriodId,
        details: reversedPayments.map((p) => ({
          paymentId: p.id,
          workerId: p.worker?.id,
          amount: p.amount,
          currency: p.currency,
          reversed: true,
        })),
      };
    } catch (error) {
      console.error(
        `[PaymentProcessing] Rollback failed for sale ${input.saleId}:`,
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

  // /**
  //  * OBTENER ESTADO: Verificar pagos de una venta específica
  //  */
  // async getSalePaymentStatus(
  //   saleId: number,
  //   cu?: JWTPayload,
  //   scopes?: ScopedAccessEnum[],
  //   manager?: EntityManager,
  // ): Promise<{
  //   hasPayments: boolean;
  //   paymentsCount: number;
  //   totalAmount: number;
  //   payments: Array<{
  //     id: number;
  //     workerId: number;
  //     workerName: string;
  //     amount: number;
  //     currency: string;
  //     ruleName: string;
  //     ruleType: string;
  //     createdAt: Date;
  //   }>;
  // }> {
  //   const payments = await this.batchService.findPaymentsBySaleId(
  //     saleId,
  //     cu,
  //     scopes,
  //     manager,
  //   );

  //   return {
  //     hasPayments: payments.length > 0,
  //     paymentsCount: payments.length,
  //     totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
  //     payments: payments.map((p) => ({
  //       id: p.id as number,
  //       workerId: p.worker?.id as number,
  //       workerName:
  //         p.worker?.user?.fullName ||
  //         `${p.worker?.tempFirstName} ${p.worker?.tempLastName}`,
  //       amount: p.amount,
  //       currency: p.currency,
  //       ruleName: p.breakdown?.ruleName || 'Unknown',
  //       ruleType: p.breakdown?.ruleType || 'Unknown',
  //       createdAt: p.createdAt!,
  //     })),
  //   };
  // }

  // /**
  //  * REPROCESAR VENTA: Forzar reprocesamiento de una venta
  //  * Útil para correcciones o cambios en reglas
  //  */
  // async reprocessSale(
  //   saleId: number,
  //   force: boolean = false,
  //   cu?: JWTPayload,
  //   scopes?: ScopedAccessEnum[],
  //   manager?: EntityManager,
  // ): Promise<{
  //   success: boolean;
  //   previousPaymentsRemoved: number;
  //   newPaymentsCreated: number;
  //   details: any[];
  // }> {
  //   try {
  //     console.log(
  //       `[PaymentProcessing] Reprocessing sale ${saleId}, force: ${force}`,
  //     );

  //     // 1. Si force=true, eliminar pagos existentes primero
  //     let previousPaymentsRemoved = 0;
  //     if (force) {
  //       const existingPayments = await this.batchService.findPaymentsBySaleId(
  //         saleId,
  //         cu,
  //         scopes,
  //         manager,
  //       );

  //       if (existingPayments.length > 0) {
  //         await this.batchService.removePayments(
  //           existingPayments.map((p) => p.id as number),
  //           'Reprocessing sale with force=true',
  //           cu,
  //           scopes,
  //           manager,
  //         );
  //         previousPaymentsRemoved = existingPayments.length;
  //       }
  //     }

  //     // 2. Procesar la venta nuevamente
  //     const processingResult = await this.realTimeProcessor.processSale(
  //       saleId,
  //       cu,
  //       scopes,
  //       manager,
  //     );

  //     return {
  //       success: true,
  //       previousPaymentsRemoved,
  //       newPaymentsCreated: processingResult.paymentsCreated,
  //       details: processingResult.details,
  //     };
  //   } catch (error) {
  //     console.error(
  //       `[PaymentProcessing] Reprocessing failed for sale ${saleId}:`,
  //       error,
  //     );

  //     return {
  //       success: false,
  //       previousPaymentsRemoved: 0,
  //       newPaymentsCreated: 0,
  //       details: [
  //         {
  //           // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  //           error: error.message,
  //           timestamp: new Date().toISOString(),
  //         },
  //       ],
  //     };
  //   }
  // }
}
