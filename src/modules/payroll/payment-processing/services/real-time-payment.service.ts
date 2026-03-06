import { Injectable, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

import { Sale } from '../../../sales/sale/entities/sale.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';

import { PaymentType } from '../../payment-rule/enums/payment-type.enum';
import { PaymentConcept } from '../../worker-payment/enums/payment-concept.enum';

import { PercentageProcessor } from './payment-processors/percentage-processor';
import { SaleQuantityProcessor } from './payment-processors/sale-quantity-processor';
import { PriceRangeProcessor } from './payment-processors/price-range-processor';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { SaleService } from '../../../sales/sale/services/sale.service';
import { PaymentRuleService } from '../../payment-rule/services/payment-rule.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { WorkerService } from '../../worker/services/worker.service';
import { WorkerPaymentService } from '../../worker-payment/services/worker-payment.service';
import { PaymentAccumulatorService } from '../../payment_accumulator/services/payment-accumulator.service';
import { PaymentAccumulator } from '../../payment_accumulator/entities/payment_accumulator.entity';
import { PaymentMethod } from '../../worker-payment/enums/payment-method.enum';
import { RealTimeCalculationResult } from '../types/real-time-calculation.types';
import { WorkerPayment } from '../../worker-payment/entities/worker-payment.entity';
import { UpdatePaymentAccumulatorInput } from '../../payment_accumulator/dto/update-payment-accumulator.input';

@Injectable()
export class RealTimePaymentService {
  REAL_TIME_PAYMENT_TYPES = [
    PaymentType.PRICE_RANGE,
    PaymentType.SALE_QUANTITY,
    PaymentType.PERCENTAGE,
  ];

  constructor(
    private readonly saleService: SaleService,
    private readonly paymentRuleService: PaymentRuleService,
    private readonly payrollPeriodService: PayrollPeriodService,
    private readonly workerService: WorkerService,
    private readonly workerPaymentService: WorkerPaymentService,
    private readonly paymentAccumulatorService: PaymentAccumulatorService,
    private readonly attendanceService: AttendanceService,

    @Inject(PercentageProcessor)
    private readonly percentageProcessor: PercentageProcessor,

    @Inject(SaleQuantityProcessor)
    private readonly saleQuantityProcessor: SaleQuantityProcessor,

    @Inject(PriceRangeProcessor)
    private readonly priceRangeProcessor: PriceRangeProcessor,
  ) {}

  /**
   * MÉTODO PRINCIPAL: Procesar una venta en tiempo real
   *
   */
  async processSale(
    saleId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    paymentsCreated: number;
    totalAmount: number;
    details: any[];
  }> {
    console.log(`[RealTimeProcessor] Procesando venta ${saleId}`);
    const details: any[] = [];
    let totalPaymentsCreated = 0;
    let totalAmount = 0;

    try {
      // 1. OBTENER VENTA Y PERÍODO
      const sale = await this.saleService.findOne(saleId, cu, scopes, manager);
      if (!sale || !sale.isConfirmed) {
        throw new Error(`Venta ${saleId} no encontrada o no confirmada`);
      }

      const saleDate = sale.effectiveDate || new Date();
      const payrollPeriod =
        await this.payrollPeriodService.getCurrentOrCreatePeriod(
          saleDate,
          cu,
          [ScopedAccessEnum.BUSINESS],
          manager,
        );

      // 2. OBTENER TODAS LAS REGLAS APLICABLES (REAL_TIME_PAYMENT_TYPES)
      const allRules = (
        await this.paymentRuleService.find(
          {
            filters: [
              {
                property: 'isActive',
                operator: ConditionalOperator.EQUAL,
                value: 'true',
              },
            ],
          },
          cu,
          scopes,
          manager,
        )
      ).data as Array<PaymentRule>;

      const applicableRules = allRules.filter(
        (rule) =>
          rule.isActive &&
          this.REAL_TIME_PAYMENT_TYPES.includes(rule.paymentType) &&
          this.doesRuleApplyToSale(rule, sale),
      );

      console.log(
        `[RealTimeProcessor] ${applicableRules.length} reglas aplicables a venta ${saleId}`,
      );

      // 3. PROCESAR CADA REGLA
      for (const rule of applicableRules) {
        try {
          const ruleResult = await this.processRuleForSale(
            rule,
            sale,
            payrollPeriod,
            cu,
            scopes,
            manager,
          );

          if (ruleResult.paymentsCreated > 0) {
            totalPaymentsCreated += ruleResult.paymentsCreated;
            totalAmount += ruleResult.totalAmount;
            details.push({
              ruleId: rule.id,
              ruleName: rule.name,
              ruleType: rule.paymentType,
              paymentsCreated: ruleResult.paymentsCreated,
              totalAmount: ruleResult.totalAmount,
              workerPayments: ruleResult.workerPayments,
            });
          }
        } catch (ruleError) {
          console.error(
            `[RealTimeProcessor] Error procesando regla ${rule.id} (${rule.name}):`,
            ruleError,
          );
          details.push({
            ruleId: rule.id,
            ruleName: rule.name,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            error: ruleError.message as string,
          });
          // Continuar con la siguiente regla
        }
      }

      console.log(
        `[RealTimeProcessor] Venta ${saleId} procesada: ${totalPaymentsCreated} pagos creados, total: ${totalAmount}`,
      );
    } catch (error) {
      console.error(
        `[RealTimeProcessor] Error crítico procesando venta ${saleId}:`,
        error,
      );
      throw error;
    }

    return {
      paymentsCreated: totalPaymentsCreated,
      totalAmount,
      details,
    };
  }

  /**
   * Verificar si una regla aplica a una venta específica
   */
  private doesRuleApplyToSale(rule: PaymentRule, sale: Sale): boolean {
    // Si la regla tiene restricción de producto/categoría
    if (rule.product?.id || rule.category?.id) {
      // Verificar si algún detalle de la venta coincide
      const hasMatchingDetail = (sale.details || []).some((detail) => {
        if (rule.product?.id && detail.product?.id === rule.product?.id) {
          return true;
        }
        if (
          rule.category?.id &&
          detail.product?.category?.id === rule.category.id
        ) {
          return true;
        }
        return false;
      });

      if (!hasMatchingDetail) {
        return false; // La regla no aplica a esta venta
      }
    }

    return true; // Regla general o con producto/categoría que sí aplica
  }

  /**
   * Procesar una regla específica para una venta
   */
  private async processRuleForSale(
    rule: PaymentRule,
    sale: Sale,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    paymentsCreated: number;
    totalAmount: number;
    workerPayments: Array<{
      workerId: number;
      amount: number;
      paymentId?: number;
    }>;
  }> {
    // ===================================================
    // VALIDACIÓN ANTI-DUPLICIDAD
    // ===================================================

    // 1. Buscar TODOS los pagos existentes para esta venta + regla
    const existingPayments = (
      await this.workerPaymentService.find(
        {
          filters: [
            {
              property: 'sale.id',
              operator: ConditionalOperator.EQUAL,
              value: String(sale.id),
            },
            {
              property: 'paymentRule.id',
              operator: ConditionalOperator.EQUAL,
              value: String(rule.id),
            },
          ],
        },
        cu,
        scopes,
        manager,
      )
    ).data as WorkerPayment[];

    if (existingPayments.length > 0) {
      // 2. ¿Es un reprocesamiento intencional?
      const shouldReprocess = await this.shouldReprocessSale(sale.id, rule.id);

      if (shouldReprocess) {
        // REPROCESAMIENTO: Eliminar pagos anteriores primero
        console.log(
          `[RealTimeProcessor] Reprocesando venta ${sale.id}, regla ${rule.id}. Eliminando ${existingPayments.length} pagos anteriores...`,
        );

        await this.workerPaymentService.remove(
          existingPayments.map((i) => i.id as number),
          cu,
          scopes,
          manager,
        );

        // También ajustar acumuladores (decrementar)
        for (const payment of existingPayments) {
          await this.adjustAccumulatorsForReprocessing(
            payment,
            rule,
            payrollPeriod,
            cu,
            scopes,
            manager,
          );
        }

        // Continuar con el procesamiento normal (creará nuevos pagos)
      } else {
        // DUPLICADO NO INTENCIONAL O NO PERMITIDO: Bloquear
        throw new Error(
          `La venta ${sale.id} ya fue procesada para la regla ${rule.name}. ` +
            `Existen ${existingPayments.length} pagos previos. ` +
            `Si necesita recalcular, debe reprocesar explícitamente.`,
        );
      }
    }

    // ===================================================
    // CONTINUAR CON EL PROCESAMIENTO NORMAL
    // ===================================================

    // 1. CALCULAR PAGOS POR WORKER (el processor maneja TODO)
    let calculationResult: RealTimeCalculationResult;

    switch (rule.paymentType) {
      case PaymentType.PERCENTAGE:
        calculationResult = await this.percentageProcessor.realTimeCalculate(
          rule,
          sale,
          payrollPeriod,
          cu,
          scopes,
          manager,
        );
        break;

      case PaymentType.SALE_QUANTITY:
        calculationResult = await this.saleQuantityProcessor.realTimeCalculate(
          rule,
          sale,
          payrollPeriod,
          cu,
          scopes,
          manager,
        );
        break;

      case PaymentType.PRICE_RANGE:
        calculationResult = await this.priceRangeProcessor.realTimeCalculate(
          rule,
          sale,
          payrollPeriod,
          cu,
          scopes,
          manager,
        );
        break;

      default:
        // FIXED_AMOUNT y otros no aplican aquí
        return { paymentsCreated: 0, totalAmount: 0, workerPayments: [] };
    }

    // Si no hay pagos calculados, retornar
    if (calculationResult.workerPayments.length === 0) {
      return { paymentsCreated: 0, totalAmount: 0, workerPayments: [] };
    }

    // 2. CREAR PAGOS Y ACTUALIZAR ACCUMULADORES
    const workerPayments: Array<{
      workerId: number;
      amount: number;
      paymentId?: number;
    }> = [];
    let totalAmount = 0;

    for (const workerPayment of calculationResult.workerPayments) {
      if (workerPayment.amount <= 0) continue;

      try {
        // A. Obtener o crear acumulador
        let accumulator: PaymentAccumulator;

        try {
          accumulator =
            await this.paymentAccumulatorService.baseFindOneByFilters({
              filters: {
                worker: { id: workerPayment.workerId },
                paymentRule: { id: rule.id },
                payrollPeriod: { id: payrollPeriod.id },
              },
              cu,
              scopes,
              manager,
            });

          // Actualizar acumulador existente si hay updates
          if (workerPayment.accumulatorUpdate) {
            await this.paymentAccumulatorService.update(
              accumulator.id as number,
              {
                id: accumulator.id as number,
                productCounter:
                  workerPayment.accumulatorUpdate.productCounter ??
                  accumulator.productCounter,
                salesTotal:
                  workerPayment.accumulatorUpdate.salesTotal ??
                  accumulator.salesTotal,
                accumulatedAmount:
                  (accumulator.accumulatedAmount || 0) + workerPayment.amount,
                accumulatedCurrency:
                  workerPayment.accumulatorUpdate.accumulatedCurrency ??
                  accumulator.accumulatedCurrency,
              },
              cu,
              scopes,
              manager,
            );
          }
        } catch {
          // Crear nuevo acumulador
          accumulator = await this.paymentAccumulatorService.create(
            {
              workerId: workerPayment.workerId,
              paymentRuleId: rule.id as number,
              payrollPeriodId: payrollPeriod.id as number,
              productCounter:
                workerPayment.accumulatorUpdate?.productCounter ?? 0,
              salesTotal: workerPayment.accumulatorUpdate?.salesTotal ?? 0,
              accumulatedAmount: workerPayment.amount,
              accumulatedCurrency:
                workerPayment.accumulatorUpdate?.accumulatedCurrency ?? 0,
              metadata: {
                ruleType: rule.paymentType,
                distributeProfits: rule.distributeProfits,
                firstPaymentFromSale: sale.id,
              },
            },
            cu,
            scopes,
            manager,
          );
        }

        // B. Crear pago de trabajador
        const createdPayment = await this.workerPaymentService.create(
          {
            workerId: workerPayment.workerId,
            saleId: sale.id,
            payrollPeriodId: payrollPeriod.id as number,
            paymentRuleId: rule.id,
            amount: workerPayment.amount,
            currency: workerPayment.currency,
            paymentConcept: this.getPaymentConcept(rule.paymentType),
            paymentMethod: PaymentMethod.CASH,
            breakdown: {
              ...workerPayment.calculationDetails,
              roleInSale: workerPayment.roleInSale,
              saleId: sale.id,
              saleDate: sale.effectiveDate,
              saleAmount: sale.totalAmount,
              ruleId: rule.id,
              ruleName: rule.name,
              ruleType: rule.paymentType,
              distributeProfits: rule.distributeProfits,
              accumulatorId: accumulator.id,
              calculationSummary: calculationResult.ruleSummary,
            },
            notes: `Venta ${sale.id} - ${rule.name} - ${workerPayment.workerName}`,
          },
          cu,
          scopes,
          manager,
        );

        workerPayments.push({
          workerId: workerPayment.workerId,
          amount: workerPayment.amount,
          paymentId: createdPayment.id,
        });

        totalAmount += workerPayment.amount;
      } catch (paymentError) {
        console.error(
          `Error creando pago para worker ${workerPayment.workerId}:`,
          paymentError,
        );
      }
    }

    return {
      paymentsCreated: workerPayments.length,
      totalAmount,
      workerPayments,
    };
  }

  /**
   * Determinar concepto de pago
   */
  private getPaymentConcept(paymentType: PaymentType): PaymentConcept {
    switch (paymentType) {
      case PaymentType.PERCENTAGE:
      case PaymentType.SALE_QUANTITY:
      case PaymentType.PRICE_RANGE:
        return PaymentConcept.COMMISSION;
      default:
        return PaymentConcept.BONUS;
    }
  }

  private async shouldReprocessSale(
    saleId: number | undefined,
    ruleId: number | undefined,
  ): Promise<boolean> {
    return true;
  }

  private async adjustAccumulatorsForReprocessing(
    payment: WorkerPayment,
    rule: PaymentRule,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<void> {
    try {
      const accumulator =
        await this.paymentAccumulatorService.baseFindOneByFilters({
          filters: {
            worker: { id: payment.worker.id },
            paymentRule: { id: rule.id },
            payrollPeriod: { id: payrollPeriod.id },
          },
          cu,
          scopes,
          manager,
        });

      if (accumulator) {
        // Preparar datos de actualización
        const updateData: UpdatePaymentAccumulatorInput = {
          id: accumulator.id as number,
          accumulatedAmount: Math.max(
            0,
            (accumulator.accumulatedAmount || 0) - payment.amount,
          ),
        };

        // Decrementar según el tipo de regla
        switch (rule.paymentType) {
          case PaymentType.SALE_QUANTITY: {
            const saleDetails = payment.sale?.details || [];
            const totalQuantity = saleDetails.reduce<number>((sum, detail) => {
              return sum + (detail.quantity || 0);
            }, 0);

            updateData.productCounter = Math.max(
              0,
              (accumulator.productCounter || 0) - totalQuantity,
            );
            break;
          }

          case PaymentType.PERCENTAGE: {
            // ❌ NO restamos salesTotal porque no tenemos la información necesaria
            // Solo restamos accumulatedAmount (ya se hace arriba)

            // Opcional: Log para tracking
            console.log(
              `[RealTimeProcessor] Percentage: omitiendo decremento de salesTotal para worker ${payment.worker.id}`,
            );
            break;
          }

          case PaymentType.PRICE_RANGE:
            // ✅ Sin declaraciones, no necesita bloque
            break;
        }

        await this.paymentAccumulatorService.update(
          accumulator.id as number,
          updateData,
          cu,
          scopes,
          manager,
        );

        console.log(
          `[RealTimeProcessor] Acumulador ajustado para worker ${payment.worker.id}: nuevo accumulatedAmount = ${updateData.accumulatedAmount}`,
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Si no existe acumulador, no hay nada que ajustar
      console.log(
        `No accumulator found for worker ${payment.worker.id}, skipping adjustment`,
      );
    }
  }
}
