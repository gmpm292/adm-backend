import { Injectable, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { ProcessPeriodPaymentsInput } from '../dto/process-payments.input';

import { RealTimePaymentService } from './real-time-payment.service';
import { PaymentPeriodService } from './payment-period.service';
import { ProcessSalePaymentInput } from '../dto/process-sale-payment.input';
import { RollbackSalePaymentsInput } from '../dto/rollback-sale-payments.input';
import { PaymentRollbackService } from './payment-rollback.service';
import { BatchSaleProcessingResult } from '../types/batch-sale-processing-result.type';
import { SaleService } from '../../../sales/sale/services/sale.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { PeriodSalesProcessingResult } from '../types/period-sales-processing-result.type';
import { Sale } from '../../../sales/sale/entities/sale.entity';

@Injectable()
export class PaymentProcessingService {
  constructor(
    @Inject(RealTimePaymentService)
    private readonly realTimeService: RealTimePaymentService,

    @Inject(PaymentPeriodService)
    private readonly periodService: PaymentPeriodService,

    @Inject(PaymentRollbackService)
    private readonly rollbackService: PaymentRollbackService,

    private readonly saleService: SaleService,
    private readonly payrollPeriodService: PayrollPeriodService,
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

      const result = await this.realTimeService.processSale(
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

  async processBatchSalePayments(
    saleIds: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<BatchSaleProcessingResult> {
    console.log(
      `[PaymentProcessing] Iniciando procesamiento batch de ${saleIds.length} ventas`,
    );

    const results: BatchSaleProcessingResult['results'] = [];
    let successful = 0;
    let failed = 0;

    for (const saleId of saleIds) {
      try {
        // Crear input para cada venta
        const input: ProcessSalePaymentInput = { saleId };

        // Llamar al método existente
        const result = await this.processSalePayment(
          input,
          cu,
          scopes,
          manager,
        );

        results.push({
          saleId,
          success: result.success,
          paymentsCreated: result.paymentsCreated,
          totalAmount: result.totalAmount,
          details: result.details,
        });

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        console.log(
          `[PaymentProcessing] Venta ${saleId} procesada: ${result.success ? '✅' : '❌'}`,
        );
      } catch (error) {
        console.error(
          `[PaymentProcessing] Error procesando venta ${saleId}:`,
          error,
        );

        results.push({
          saleId,
          success: false,
          paymentsCreated: 0,
          totalAmount: 0,
          error: error instanceof Error ? error.message : String(error),
          details: [],
        });
        failed++;
      }
    }

    const totalProcessed = results.length;
    const success = failed === 0;

    console.log(
      `[PaymentProcessing] Batch completado. ` +
        `Total: ${totalProcessed}, ✅ Éxitos: ${successful}, ❌ Fallos: ${failed}`,
    );

    return {
      success,
      totalProcessed,
      successful,
      failed,
      results,
    };
  }

  /**
   * Procesar todas las ventas de un período específico
   * Busca todas las ventas confirmadas del período y las procesa en batch
   */
  async processPeriodSales(
    payrollPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PeriodSalesProcessingResult> {
    console.log(
      `[PaymentProcessing] Iniciando procesamiento de ventas para el período ${payrollPeriodId}`,
    );

    try {
      // 1. Validar que el período existe
      const payrollPeriod = await this.payrollPeriodService.validatePeriod(
        payrollPeriodId,
        cu,
        scopes,
        manager,
      );

      // 2. Construir filtros para buscar ventas del período
      const filters = [
        {
          property: 'isConfirmed',
          operator: ConditionalOperator.EQUAL,
          value: 'true',
        },
        {
          property: 'effectiveDate',
          operator: ConditionalOperator.GREATER_EQUAL_THAN,
          value: payrollPeriod.startDate.toISOString(),
        },
        {
          property: 'effectiveDate',
          operator: ConditionalOperator.LESS_EQUAL_THAN,
          value: payrollPeriod.endDate.toISOString(),
        },
      ];

      // Aplicar filtros de scope si existen
      if (cu?.businessId) {
        filters.push({
          property: 'businessId',
          operator: ConditionalOperator.EQUAL,
          value: String(cu.businessId),
        });
      }

      // 3. Obtener todas las ventas del período
      console.log(
        `[PaymentProcessing] Buscando ventas confirmadas del período ${payrollPeriodId}`,
      );

      const sales = (
        await this.saleService.find(
          {
            filters,
            take: 1000, // Límite razonable, podríamos hacer paginación si es necesario
          },
          cu,
          scopes,
          manager,
        )
      ).data as Array<Sale>;

      const saleIds: Array<number> = sales
        .map((sale) => sale.id)
        .filter((id): id is number => id !== undefined);

      console.log(
        `[PaymentProcessing] Encontradas ${saleIds.length} ventas confirmadas en el período ${payrollPeriodId}`,
      );

      if (saleIds.length === 0) {
        return {
          success: true,
          payrollPeriodId,
          totalSales: 0,
          successful: 0,
          failed: 0,
          totalPaymentsCreated: 0,
          totalAmount: 0,
          results: [],
        };
      }

      // 4. Procesar las ventas usando el método batch existente
      const batchResult = await this.processBatchSalePayments(
        saleIds,
        cu,
        scopes,
        manager,
      );

      // 5. Calcular totales adicionales
      const totalPaymentsCreated = batchResult.results.reduce(
        (sum, r) => sum + (r.paymentsCreated || 0),
        0,
      );

      const totalAmount = batchResult.results.reduce(
        (sum, r) => sum + (r.totalAmount || 0),
        0,
      );

      console.log(
        `[PaymentProcessing] Procesamiento de ventas del período ${payrollPeriodId} completado. ` +
          `Ventas: ${batchResult.totalProcessed}, ` +
          `Pagos creados: ${totalPaymentsCreated}, ` +
          `Monto total: ${totalAmount}`,
      );

      return {
        success: batchResult.success,
        payrollPeriodId,
        totalSales: batchResult.totalProcessed,
        successful: batchResult.successful,
        failed: batchResult.failed,
        totalPaymentsCreated,
        totalAmount,
        results: batchResult.results,
      };
    } catch (error) {
      console.error(
        `[PaymentProcessing] Error procesando ventas del período ${payrollPeriodId}:`,
        error,
      );

      return {
        success: false,
        payrollPeriodId,
        totalSales: 0,
        successful: 0,
        failed: 1,
        totalPaymentsCreated: 0,
        totalAmount: 0,
        results: [
          {
            saleId: 0,
            success: false,
            paymentsCreated: 0,
            totalAmount: 0,
            error: error instanceof Error ? error.message : String(error),
            details: [],
          },
        ],
      };
    }
  }

  /**
   * MÉTODO PeriodPayments: Procesar pagos de un período completo
   * Para reglas FIXED_AMOUNT u otras asociadas al periodo completo.
   */
  async processPeriodPayments(
    input: ProcessPeriodPaymentsInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingSummary> {
    try {
      console.log(
        `[PaymentProcessing] Starting batch processing for period ${input.payrollPeriodId || 'actual'}`,
      );

      const result = await this.periodService.processPeriodPayments(
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
