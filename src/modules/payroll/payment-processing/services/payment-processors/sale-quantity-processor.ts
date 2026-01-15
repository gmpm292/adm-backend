import { Injectable } from '@nestjs/common';
import { BasePaymentProcessor } from './base-processor';
import {
  RealTimeCalculationResult,
  RealTimeWorkerPayment,
} from '../../types/real-time-calculation.types';
import { PaymentType } from '../../../payment-rule/enums/payment-type.enum';
import { PaymentRule } from '../../../payment-rule/entities/payment-rule.entity';
import { JWTPayload } from '../../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../../core/enums/scoped-access.enum';
import { Worker } from '../../../worker/entities/worker.entity';
import { WorkerType } from '../../../worker/enums/worker-type.enum';
import { WorkerService } from '../../../worker/services/worker.service';
import { ConditionalOperator } from '../../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { AttendanceService } from '../../../attendance/services/attendance.service';
import { PaymentAccumulatorService } from '../../../payment_accumulator/services/payment-accumulator.service';
import { Sale } from '../../../../sales/sale/entities/sale.entity';
import { PayrollPeriod } from '../../../payroll-period/entities/payroll-period.entity';
import { EntityManager } from 'typeorm';
import { PaymentAccumulator } from '../../../payment_accumulator/entities/payment_accumulator.entity';
import { ListFilter } from '../../../../../core/graphql/remote-operations';
import { Attendance } from '../../../attendance/entities/attendance.entity';
import { AttendanceStatus } from '../../../attendance/enums/attendance-status.enum';
import { SaleQuantityCondition } from '../../../payment-rule/types/sale-quantity-condition.type';

@Injectable()
export class SaleQuantityProcessor extends BasePaymentProcessor {
  protected readonly supportedPaymentType = PaymentType.SALE_QUANTITY;

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly workerService: WorkerService,
    private readonly paymentAccumulatorService: PaymentAccumulatorService,
  ) {
    super();
  }

  async realTimeCalculate(
    rule: PaymentRule,
    sale: Sale,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<RealTimeCalculationResult> {
    // 1. VALIDAR QUE LA REGLA ESTÉ ACTIVA
    if (!rule.isActive) {
      throw new Error(`La regla ${rule.name} no está activa`);
    }

    const saleQuantityConditions = rule.conditions.saleQuantity || [];
    if (saleQuantityConditions.length === 0) {
      return {
        workerPayments: [],
        ruleSummary: {
          ruleId: rule.id as number,
          ruleName: rule.name,
          ruleType: rule.paymentType,
          totalAmount: 0,
          totalWorkers: 0,
          distributeProfitsApplied: rule.distributeProfits,
          baseCalculation: {
            amount: 0,
            currency: rule.paymentCurrency,
          },
        },
      };
    }

    const saleDate = sale.effectiveDate || new Date();

    // 2. BUSCAR PRODUCTOS Y CANTIDADES EN LA VENTA
    const productDetails: Array<{
      productId?: number;
      productName?: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const detail of sale.details || []) {
      // Verificar si el producto/categoría aplica a la regla
      const productApplies =
        !rule.product?.id || detail.product?.id === rule.product?.id;
      const categoryApplies =
        !rule.category?.id ||
        detail.product?.category?.id === rule.category?.id;

      if (productApplies && categoryApplies) {
        const quantity = detail.quantity || 0;
        const unitPrice = detail.product?.basePrice || 0;

        if (quantity > 0) {
          productDetails.push({
            productId: detail.product?.id,
            productName: detail.product?.name,
            quantity,
            unitPrice,
          });
        }
      }
    }

    if (productDetails.length === 0) {
      return {
        workerPayments: [],
        ruleSummary: {
          ruleId: rule.id as number,
          ruleName: rule.name,
          ruleType: rule.paymentType,
          totalAmount: 0,
          totalWorkers: 0,
          distributeProfitsApplied: rule.distributeProfits,
          baseCalculation: {
            amount: 0,
            currency: rule.paymentCurrency,
          },
        },
      };
    }

    // 3. OBTENER WORKERS QUE APLICAN A ESTA REGLA
    let applicableWorkers: Worker[] = [];
    let effectiveDistributeProfits = false;

    if (!rule.distributeProfits) {
      // DISTRIBUTE_PROFITS = FALSE
      if (rule.workerType === WorkerType.AGENT) {
        // Solo el agente que vendió
        if (
          sale.salesWorker &&
          sale.salesWorker.workerType === WorkerType.AGENT
        ) {
          applicableWorkers = [sale.salesWorker];
        }
      } else if (rule.workerType === WorkerType.PUBLICIST) {
        // Todos los publicistas de la venta
        const publicists = new Map<number, Worker>();
        for (const detail of sale.details || []) {
          for (const publicist of detail.publicists || []) {
            if (publicist.workerType === WorkerType.PUBLICIST) {
              publicists.set(publicist.id as number, publicist);
            }
          }
        }
        applicableWorkers = Array.from(publicists.values());
      } else {
        // Otros tipos de workers: forzar distribución
        effectiveDistributeProfits = true;
      }
    }

    if (rule.distributeProfits || effectiveDistributeProfits) {
      // DISTRIBUTE_PROFITS = TRUE
      // Buscar todos los workers del mismo tipo que tengan asistencia
      const filters: ListFilter[] = [
        {
          property: 'workerType',
          operator: ConditionalOperator.EQUAL,
          value: rule.workerType,
        },
        {
          property: 'isActive',
          operator: ConditionalOperator.EQUAL,
          value: 'true',
        },
      ];

      if (rule.workerType === WorkerType.OTHER && rule.otherType) {
        filters.push({
          property: 'otherType',
          operator: ConditionalOperator.EQUAL,
          value: rule.otherType,
        });
      }

      if (
        rule.scope === ScopedAccessEnum.BUSINESS &&
        sale.salesWorker?.business?.id
      ) {
        filters.push({
          property: 'business.id',
          operator: ConditionalOperator.EQUAL,
          value: String(sale.salesWorker?.business?.id),
        });
      }
      if (
        rule.scope === ScopedAccessEnum.OFFICE &&
        sale.salesWorker?.office?.id
      ) {
        filters.push({
          property: 'office.id',
          operator: ConditionalOperator.EQUAL,
          value: String(sale.salesWorker?.office?.id),
        });
      }
      if (
        rule.scope === ScopedAccessEnum.DEPARTMENT &&
        sale.salesWorker?.department?.id
      ) {
        filters.push({
          property: 'department.id',
          operator: ConditionalOperator.EQUAL,
          value: String(sale.salesWorker?.department?.id),
        });
      }
      if (rule.scope === ScopedAccessEnum.TEAM && sale.salesWorker?.team?.id) {
        filters.push({
          property: 'team.id',
          operator: ConditionalOperator.EQUAL,
          value: String(sale.salesWorker?.team?.id),
        });
      }

      const workersResult = await this.workerService.find(
        { filters },
        cu,
        scopes,
        manager,
      );

      const allWorkers = workersResult.data as Worker[];

      // Filtrar por asistencia
      // OPCIÓN 1: UNA SOLA CONSULTA PARA TODAS LAS ASISTENCIAS (EFICIENTE)
      const allAttendances = await this.attendanceService.findDailyAttendance(
        saleDate,
        cu,
        scopes,
        manager,
      );

      // Crear mapa rápido workerId -> attendance
      const attendanceMap = new Map<number, Attendance>();
      for (const attendance of allAttendances) {
        if (attendance.worker?.id) {
          attendanceMap.set(attendance.worker.id, attendance);
        }
      }

      // Filtrar workers con asistencia válida
      for (const worker of allWorkers) {
        const attendance = attendanceMap.get(worker.id as number);

        if (
          attendance &&
          attendance.status === AttendanceStatus.PRESENT &&
          attendance.countsForProfitSharing === true
        ) {
          applicableWorkers.push(worker);
        }
      }
    }

    if (applicableWorkers.length === 0) {
      return {
        workerPayments: [],
        ruleSummary: {
          ruleId: rule.id as number,
          ruleName: rule.name,
          ruleType: rule.paymentType,
          totalAmount: 0,
          totalWorkers: 0,
          distributeProfitsApplied: rule.distributeProfits,
          baseCalculation: {
            amount: 0,
            currency: rule.paymentCurrency,
          },
        },
      };
    }

    // 4. OBTENER ACUMULADORES
    const workersWithAccumulators: Array<{
      worker: Worker;
      accumulator?: PaymentAccumulator;
      currentProductCounter: number;
    }> = [];

    for (const worker of applicableWorkers) {
      try {
        const accumulator =
          await this.paymentAccumulatorService.baseFindOneByFilters({
            filters: {
              worker: { id: worker.id },
              paymentRule: { id: rule.id },
              payrollPeriod: { id: payrollPeriod.id },
            },
            cu,
            scopes,
            manager,
          });
        workersWithAccumulators.push({
          worker,
          accumulator,
          currentProductCounter: accumulator?.productCounter || 0,
        });
      } catch {
        workersWithAccumulators.push({
          worker,
          accumulator: undefined,
          currentProductCounter: 0,
        });
      }
    }

    // 5. ORDENAR CONDICIONES POR minProducts
    const sortedConditions = [...saleQuantityConditions].sort((a, b) => {
      return (a.minProducts || 0) - (b.minProducts || 0);
    });

    // 6. CALCULAR PAGOS POR PRODUCTO PARA CADA WORKER
    const workerCalculations: Map<
      number,
      {
        totalAmount: number;
        productCounterIncrement: number;
        productBreakdown: Array<{
          productNumber: number;
          amount: number;
          conditionApplied: string;
          originalAmount: number;
        }>;
      }
    > = new Map();

    // Inicializar cálculos para cada worker
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const { worker, currentProductCounter } of workersWithAccumulators) {
      workerCalculations.set(worker.id as number, {
        totalAmount: 0,
        productCounterIncrement: 0,
        productBreakdown: [],
      });
    }

    // Procesar cada producto en la venta
    for (const productDetail of productDetails) {
      const { quantity, unitPrice } = productDetail;

      // Para cada unidad del producto
      for (let unitIndex = 0; unitIndex < quantity; unitIndex++) {
        // Para cada worker, procesar esta unidad
        for (const {
          worker,
          currentProductCounter: currentProductCounter,
        } of workersWithAccumulators) {
          const workerId = worker.id as number;
          const workerCalculation = workerCalculations.get(workerId)!;

          // Determinar el número de producto para este worker
          const productNumber =
            currentProductCounter +
            workerCalculation.productCounterIncrement +
            1;

          // Encontrar condición aplicable para este número de producto
          let applicableCondition: SaleQuantityCondition | null = null;
          let conditionIndex = -1;

          for (let i = sortedConditions.length - 1; i >= 0; i--) {
            const condition = sortedConditions[i];
            if (productNumber >= (condition.minProducts || 0)) {
              applicableCondition = condition;
              conditionIndex = i;
              break;
            }
          }

          // Si no se encuentra condición, usar la primera (mínima)
          if (!applicableCondition && sortedConditions.length > 0) {
            applicableCondition = sortedConditions[0];
            conditionIndex = 0;
          }

          if (applicableCondition) {
            // Calcular monto para esta unidad
            let unitAmount = 0;
            let conditionDescription = '';

            if (applicableCondition.ratePerProduct !== undefined) {
              unitAmount = applicableCondition.ratePerProduct;
              conditionDescription = `$${applicableCondition.ratePerProduct} fijo`;
            } else if (applicableCondition.percentagePerProduct !== undefined) {
              unitAmount =
                (unitPrice * applicableCondition.percentagePerProduct) / 100;
              conditionDescription = `${applicableCondition.percentagePerProduct}% de $${unitPrice}`;
            }

            // Determinar rango del condition
            const nextCondition = sortedConditions[conditionIndex + 1];
            const rangeStart = applicableCondition.minProducts || 0;
            const rangeEnd = nextCondition
              ? nextCondition.minProducts - 1
              : '∞';

            // Acumular cálculo
            //workerCalculation.totalAmount += unitAmount;
            const totalApplicableWorkers = applicableWorkers.length;
            const scaledAmount = unitAmount / totalApplicableWorkers;
            workerCalculation.totalAmount += scaledAmount;
            workerCalculation.productCounterIncrement += 1;

            // Guardar detalles (solo para primeros productos para no hacer el objeto muy grande)
            if (workerCalculation.productBreakdown.length < 5) {
              workerCalculation.productBreakdown.push({
                productNumber,
                amount: scaledAmount,
                conditionApplied: `Productos ${rangeStart}-${rangeEnd}: ${conditionDescription}`,
                originalAmount: unitAmount,
              });
            }
          }
        }
      }
    }

    // 7. PREPARAR RESULTADOS FINALES (sin paso de distribución separado)
    const workerPayments: RealTimeWorkerPayment[] = [];
    let totalAmountPaid = 0;

    for (const { worker, accumulator } of workersWithAccumulators) {
      const workerId = worker.id as number;
      const workerCalculation = workerCalculations.get(workerId);

      // Si el worker no tiene cálculo, continuar
      if (!workerCalculation || workerCalculation.totalAmount <= 0) continue;

      const finalAmount = workerCalculation.totalAmount; // Ya está escalado desde el paso 6

      // Determinar rol en la venta
      let roleInSale: 'MAIN_SELLER' | 'PUBLICIST' | 'OTHER' = 'OTHER';
      if (sale.salesWorker?.id === worker.id) {
        roleInSale = 'MAIN_SELLER';
      } else {
        const isPublicist = (sale.details || []).some((detail) =>
          (detail.publicists || []).some((p) => p.id === worker.id),
        );
        if (isPublicist) {
          roleInSale = 'PUBLICIST';
        }
      }

      workerPayments.push({
        workerId,
        workerName:
          worker.user?.fullName ||
          `${worker.tempFirstName || ''} ${worker.tempLastName || ''}`.trim(),
        amount: finalAmount,
        currency: rule.paymentCurrency,
        roleInSale,
        calculationDetails: {
          baseAmount: workerCalculation.totalAmount,
          totalWorkers: applicableWorkers.length,
          productCount: workerCalculation.productCounterIncrement,
          totalProductsInSale: productDetails.reduce(
            (sum, p) => sum + p.quantity,
            0,
          ),
          conditions: sortedConditions.map((c) => ({
            minProducts: c.minProducts,
            ratePerProduct: c.ratePerProduct,
            percentagePerProduct: c.percentagePerProduct,
          })),
          productBreakdown: workerCalculation.productBreakdown,
          distributeProfitsApplied: rule.distributeProfits,
        },
        accumulatorUpdate: {
          productCounter:
            (accumulator?.productCounter || 0) +
            workerCalculation.productCounterIncrement,
          accumulatedAmount:
            (accumulator?.accumulatedAmount || 0) + finalAmount,
        },
      });

      totalAmountPaid += finalAmount;
    }

    // Calcular total calculado (para el summary)
    const totalCalculatedAmount = Array.from(
      workerCalculations.values(),
    ).reduce((sum, calc) => sum + calc.totalAmount, 0);

    return {
      workerPayments,
      ruleSummary: {
        ruleId: rule.id as number,
        ruleName: rule.name,
        ruleType: rule.paymentType,
        totalAmount: totalAmountPaid,
        totalWorkers: workerPayments.length,
        distributeProfitsApplied: rule.distributeProfits,
        baseCalculation: {
          amount: totalCalculatedAmount,
          currency: rule.paymentCurrency,
        },
      },
    };
  }
}
