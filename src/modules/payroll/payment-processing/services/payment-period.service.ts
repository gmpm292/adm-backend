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

/**
 * Pagos que se calculan por período completo y no venta a venta: hoy solo las
 * reglas de importe fijo (`FIXED_AMOUNT`).
 */
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
   * Crea los pagos de las reglas de período activas para el período indicado
   * (o el que contiene hoy, creándolo si no existe). Cada regla se procesa
   * por separado: los errores no se lanzan, se devuelven como filas `ERROR`.
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
            cu?.businessId ?? input.businessId,
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
   * Reglas activas cuyo tipo está en `FOR_PERIOD_PAYMENT_TYPES`, de la
   * empresa del período (o sin empresa) y dentro del alcance del usuario.
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
    ];
    // Un SUPER ve las reglas de todas las empresas: solo las del período y
    // las que no tienen empresa (las crea un SUPER sin empresa)
    const businessId =
      payrollPeriod.business?.id ?? input.businessId ?? cu?.businessId;
    if (businessId) {
      filters.push({
        filters: [
          {
            property: 'businessId',
            operator: ConditionalOperator.EQUAL,
            value: String(businessId),
            logicalOperator: LogicalOperator.OR,
          },
          {
            property: 'businessId',
            operator: ConditionalOperator.IS_NULL,
            value: '',
            logicalOperator: LogicalOperator.OR,
          },
        ],
      });
    }

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
   * Calcula con el procesador del tipo de la regla y crea un pago `SALARY` por
   * trabajador. Si ya hay pago de esa regla, trabajador y período, se omite
   * (`SKIPPED`); con `force` se elimina y se rehace, salvo que ya esté
   * pagado: lo pagado no se recalcula y también queda `SKIPPED`.
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
        // Pagos que ya hay de este worker, regla y período
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

        // Lo pagado no se toca ni con `force`; sin `force`, nada se rehace
        const paidPayment = existingPayments.find((p) => !!p.paidDate);
        if (paidPayment || (existingPayments.length > 0 && !input.force)) {
          const existing = paidPayment ?? existingPayments[0];
          results.push({
            workerId: workerPayment.workerId,
            workerName: workerPayment.workerName,
            amount: workerPayment.amount,
            currency: workerPayment.currency,
            paymentConcept: PaymentConcept.SALARY,
            status: 'SKIPPED',
            details: {
              existingPaymentId: existing.id,
              ruleId: rule.id,
              ruleName: rule.name,
              note: paidPayment
                ? 'Pago ya hecho: no se recalcula'
                : 'Pago ya existente, force=false',
            },
          });
          continue;
        }

        // Con force se rehacen los pendientes
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

              // Detalles del cálculo (ámbito, multiplicador, período...)
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
