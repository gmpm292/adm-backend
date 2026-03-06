import { Injectable, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { PaymentProcessingResult } from '../types/payment-processing-result.type';
import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { ProcessPeriodPaymentsInput } from '../dto/process-payments.input';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';
import { WorkerService } from '../../worker/services/worker.service';
import { WorkerPaymentService } from '../../worker-payment/services/worker-payment.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { PaymentRuleService } from '../../payment-rule/services/payment-rule.service';
import { PaymentType } from '../../payment-rule/enums/payment-type.enum';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { FixedAmountProcessor } from './payment-processors/fixed-amount-processor';
import { PaymentConcept } from '../../worker-payment/enums/payment-concept.enum';
import { PaymentMethod } from '../../worker-payment/enums/payment-method.enum';
import { ListFilter } from '../../../../core/graphql/remote-operations';
import { LogicalOperator } from '../../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { PeriodBatchCalculationResult } from '../types/payment-calculation.types';
import { WorkerPayment } from '../../worker-payment/entities/worker-payment.entity';

@Injectable()
export class PaymentPeriodService {
  // Tipos de pago que se procesan en batch (al final del período)
  private readonly FOR_PERIOD_PAYMENT_TYPES = [PaymentType.FIXED_AMOUNT];

  constructor(
    private readonly workerService: WorkerService,
    private readonly workerPaymentService: WorkerPaymentService,
    private readonly payrollPeriodService: PayrollPeriodService,
    private readonly paymentRuleService: PaymentRuleService,
    @Inject(FixedAmountProcessor)
    private readonly fixedAmountProcessor: FixedAmountProcessor,
  ) {}

  /**
   * Procesar pagos de un período completo (Batch)
   */
  /**
   * Procesar pagos de un período completo (Batch)
   */
  async processPeriodPayments(
    input: ProcessPeriodPaymentsInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingSummary> {
    const results: PaymentProcessingResult[] = [];
    let totalSuccessCount = 0;
    let totalErrorCount = 0;

    try {
      console.log(
        `[PaymentBatch] Iniciando procesamiento batch para período ${input.payrollPeriodId || 'actual'}`,
      );

      // 1. Obtener período
      let payrollPeriod: PayrollPeriod;
      if (input.payrollPeriodId) {
        // Validar período
        payrollPeriod = await this.payrollPeriodService.validatePeriod(
          input.payrollPeriodId,
          cu,
          scopes,
          manager,
        );
      } else {
        payrollPeriod =
          await this.payrollPeriodService.getCurrentOrCreatePeriod(
            new Date(),
            cu,
            scopes,
            manager,
          );
      }

      // 2. Obtener todas las reglas aplicables para batch
      const applicableRules = await this.getApplicableBatchRules(
        input,
        payrollPeriod,
        cu,
        scopes,
        manager,
      );

      console.log(
        `[PaymentBatch] ${applicableRules.length} reglas aplicables encontradas`,
      );

      // 3. Procesar CADA REGLA
      for (const rule of applicableRules) {
        try {
          console.log(
            `[PaymentBatch] Procesando regla: ${rule.name} (${rule.paymentType})`,
          );

          const ruleResult = await this.processRuleForPeriod(
            rule,
            input,
            payrollPeriod,
            cu,
            scopes,
            manager,
          );

          results.push(...ruleResult.results);
          totalSuccessCount += ruleResult.successCount;
          totalErrorCount += ruleResult.errorCount;

          console.log(
            `[PaymentBatch] Regla ${rule.name} procesada: ${ruleResult.successCount} éxitos, ${ruleResult.errorCount} errores`,
          );
        } catch (ruleError) {
          console.error(
            `[PaymentBatch] Error procesando regla ${rule.id}:`,
            ruleError,
          );
          totalErrorCount++;

          results.push({
            workerId: 0,
            workerName: `Regla ${rule.name}`,
            amount: 0,
            currency: 'CUP',
            paymentConcept: 'ERROR',
            status: 'ERROR',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            errors: [ruleError.message],
            details: {
              ruleId: rule.id,
              ruleName: rule.name,
              ruleType: rule.paymentType,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              error: ruleError.message,
            },
          });
        }
      }

      console.log(
        `[PaymentBatch] Procesamiento completado. Total: ${results.length}, Éxitos: ${totalSuccessCount}, Errores: ${totalErrorCount}`,
      );

      return {
        data: results,
        totalCount: results.length,
        successCount: totalSuccessCount,
        errorCount: totalErrorCount,
      };
    } catch (error) {
      console.error(
        '[PaymentBatch] Error crítico en processPeriodPayments:',
        error,
      );

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
   * Obtener reglas aplicables para procesamiento batch
   */
  private async getApplicableBatchRules(
    input: ProcessPeriodPaymentsInput,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentRule[]> {
    // Construir filtros base
    const filters: ListFilter[] = [
      {
        property: 'isActive',
        operator: ConditionalOperator.EQUAL,
        value: 'true',
      },
      // {
      //   property: 'business.id',
      //   operator: ConditionalOperator.EQUAL,
      //   value: String(cu?.businessId),
      // },
    ];

    // Filtro para tipos de pago por periodo
    const typeFilters: ListFilter[] = [];
    for (const type of this.FOR_PERIOD_PAYMENT_TYPES) {
      typeFilters.push({
        property: 'paymentType',
        operator: ConditionalOperator.EQUAL,
        value: String(type),
        logicalOperator: LogicalOperator.OR,
      });
    }
    filters.push({ filters: typeFilters });

    const rulesResult = await this.paymentRuleService.find(
      { filters },
      cu,
      scopes,
      manager,
    );

    return rulesResult.data as PaymentRule[];
  }

  /**
   * Procesar una regla específica para todo el período
   */
  private async processRuleForPeriod(
    rule: PaymentRule,
    input: ProcessPeriodPaymentsInput,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    results: PaymentProcessingResult[];
    successCount: number;
    errorCount: number;
  }> {
    const results: PaymentProcessingResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // 1. CALCULAR PAGOS POR WORKER (el processor maneja TODO)
    let calculationResult: PeriodBatchCalculationResult;

    // Switch solo para identificar el processor
    switch (rule.paymentType) {
      case PaymentType.FIXED_AMOUNT:
        calculationResult =
          await this.fixedAmountProcessor.calculateBatchForPeriod(
            rule,
            input,
            payrollPeriod,
            cu,
            scopes,
            manager,
          );
        break;

      default:
        console.warn(
          `[PaymentBatch] Tipo de regla no soportado para batch: ${rule.paymentType}`,
        );
        return { results, successCount, errorCount };
    }

    // Si no hay pagos calculados, retornar
    if (calculationResult.workerPayments.length === 0) {
      console.log(
        `[PaymentBatch] No hay pagos calculados para la regla ${rule.name}`,
      );
      return { results, successCount, errorCount };
    }

    // 2. CREAR PAGOS PARA CADA WORKER (lógica genérica fuera del switch)
    for (const workerPayment of calculationResult.workerPayments) {
      if (workerPayment.amount <= 0) continue;

      try {
        // Verificar si ya existe pago para este worker, regla y período
        if (!input.force) {
          const existingPayment = (
            await this.workerPaymentService.find(
              {
                filters: [
                  {
                    property: 'worker.id',
                    operator: ConditionalOperator.EQUAL,
                    value: String(workerPayment.workerId),
                  },
                  {
                    property: 'payrollPeriod.id',
                    operator: ConditionalOperator.EQUAL,
                    value: String(payrollPeriod.id),
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

          if (existingPayment.length > 0) {
            // SKIP: Ya existe pago
            results.push({
              workerId: workerPayment.workerId,
              workerName: workerPayment.workerName,
              amount: workerPayment.amount,
              currency: workerPayment.currency,
              paymentConcept: PaymentConcept.SALARY,
              status: 'SKIPPED',
              details: {
                existingPaymentId: existingPayment[0].id,
                ruleId: rule.id,
                ruleName: rule.name,
                note: 'Pago ya existente, force=false',
              },
            });
            continue;
          }
        }

        // Si force=true y existe pago, eliminarlo primero
        if (input.force) {
          const existingPayments = (
            await this.workerPaymentService.find(
              {
                filters: [
                  {
                    property: 'worker.id',
                    operator: ConditionalOperator.EQUAL,
                    value: String(workerPayment.workerId),
                  },
                  {
                    property: 'payrollPeriod.id',
                    operator: ConditionalOperator.EQUAL,
                    value: String(payrollPeriod.id),
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
            await this.workerPaymentService.remove(
              existingPayments.map((p) => p.id as number),
              cu,
              scopes,
              manager,
            );
            console.log(
              `[PaymentBatch] Eliminados ${existingPayments.length} pagos existentes para worker ${workerPayment.workerId}`,
            );
          }
        }

        // Crear nuevo pago
        const createdPayment = await this.workerPaymentService.create(
          {
            workerId: workerPayment.workerId,
            payrollPeriodId: payrollPeriod.id as number,
            paymentRuleId: rule.id,
            amount: workerPayment.amount,
            currency: workerPayment.currency,
            paymentConcept: PaymentConcept.SALARY,
            paymentMethod: PaymentMethod.CASH,
            breakdown: {
              // Propiedades requeridas por el DTO
              ruleId: rule.id,
              ruleName: rule.name,
              ruleType: rule.paymentType,
              baseSalary: workerPayment.amount, // Fixed amount = base salary

              // Propiedades opcionales inicializadas
              commissions: 0,
              bonuses: 0,
              deductions: 0,

              // Propiedades de trazabilidad
              //scope: rule.scope,
              //workerId: workerPayment.workerId,
              //workerName: workerPayment.workerName,
              //payrollPeriodId: payrollPeriod.id,
              //periodStart: payrollPeriod.startDate,
              //periodEnd: payrollPeriod.endDate,
              //batchProcessed: true,
              //forceApplied: input.force || false,

              // Todos los detalles de cálculo van aquí
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              calculationSummary: workerPayment.calculationDetails,
            },
            notes: `Pago batch período ${payrollPeriod.id} - ${rule.name}`,
          },
          cu,
          scopes,
          manager,
        );

        results.push({
          workerId: workerPayment.workerId,
          workerName: workerPayment.workerName,
          amount: workerPayment.amount,
          currency: workerPayment.currency,
          paymentConcept: PaymentConcept.SALARY,
          status: 'SUCCESS',
          details: {
            paymentId: createdPayment.id,
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.paymentType,
            scope: rule.scope,
          },
        });
        successCount++;
      } catch (paymentError) {
        console.error(
          `[PaymentBatch] Error creando pago para worker ${workerPayment.workerId}:`,
          paymentError,
        );

        results.push({
          workerId: workerPayment.workerId,
          workerName: workerPayment.workerName,
          amount: 0,
          currency: workerPayment.currency,
          paymentConcept: PaymentConcept.SALARY,
          status: 'ERROR',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          errors: [paymentError.message],
          details: {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.paymentType,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            error: paymentError.message,
          },
        });
        errorCount++;
      }
    }

    return { results, successCount, errorCount };
  }
}
