import { Injectable, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { ProcessPaymentsInput } from '../dto/process-payments.input';

import { RealTimePaymentService } from './real-time-payment.service';
import { PaymentBatchService } from './payment-batch.service';
import { ProcessSalePaymentInput } from '../dto/process-sale-payment.input';
import { RollbackSalePaymentsInput } from '../dto/rollback-sale-payments.input';
import { PaymentRollbackService } from './payment-rollback.service';

@Injectable()
export class PaymentProcessingService {
  constructor(
    @Inject(RealTimePaymentService)
    private readonly realTimeProcessor: RealTimePaymentService,

    @Inject(PaymentBatchService)
    private readonly batchService: PaymentBatchService,

    @Inject(PaymentRollbackService)
    private readonly rollbackService: PaymentRollbackService,
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
   * Delega toda la lógica al servicio especializado
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
    console.log(
      `[PaymentProcessing] Delegando reversión de venta ${input.saleId} al servicio especializado`,
    );

    return this.rollbackService.rollbackSalePayments(
      input,
      cu,
      scopes,
      manager,
    );
  }
}
