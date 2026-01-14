// payment-processing/services/payment-processors/price-range-processor.ts
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
import { PriceRangeCondition } from '../../../payment-rule/types/price-range-condition.type';
import { PaymentAccumulator } from '../../../payment_accumulator/entities/payment_accumulator.entity';
import { Attendance } from '../../../attendance/entities/attendance.entity';
import { AttendanceStatus } from '../../../attendance/enums/attendance-status.enum';

@Injectable()
export class PriceRangeProcessor extends BasePaymentProcessor {
  protected readonly supportedPaymentType = PaymentType.PRICE_RANGE;

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

    const priceRanges = rule.conditions.priceRanges || [];
    if (priceRanges.length === 0) {
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

    // 2. BUSCAR PRODUCTOS, CANTIDADES Y PRECIOS EN LA VENTA
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

        if (quantity > 0 && unitPrice > 0) {
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

    // 3. ORDENAR RANGOS POR PRECIO MÍNIMO
    const sortedRanges = [...priceRanges].sort((a, b) => {
      return (a.min || 0) - (b.min || 0);
    });

    // 4. CALCULAR BENEFICIO TOTAL POR PRODUCTO
    let baseAmount = 0;
    const productCalculations: Array<{
      productName?: string;
      quantity: number;
      unitPrice: number;
      totalProductAmount: number;
      rangeApplied: string;
      amountPerUnit: number;
    }> = [];

    for (const productDetail of productDetails) {
      const { quantity, unitPrice } = productDetail;

      // Encontrar rango aplicable para este precio unitario
      let applicableRange: PriceRangeCondition | undefined = undefined;
      let rangeDescription = '';

      for (let i = 0; i < sortedRanges.length; i++) {
        const range = sortedRanges[i];
        const nextRange = sortedRanges[i + 1];

        const rangeMin = range.min || 0;
        const rangeMax = nextRange ? nextRange.min : range.max || Infinity;

        if (unitPrice >= rangeMin && unitPrice < rangeMax) {
          applicableRange = range;

          // Construir descripción del rango
          if (range.amount !== undefined) {
            rangeDescription = `$${rangeMin}-${rangeMax} = $${range.amount} fijo`;
          } else if (range.percentage !== undefined) {
            rangeDescription = `$${rangeMin}-${rangeMax} = ${range.percentage}%`;
          } else {
            rangeDescription = `$${rangeMin}-${rangeMax}`;
          }
          break;
        }
      }

      // Si no se encuentra rango, usar el último como fallback
      if (!applicableRange && sortedRanges.length > 0) {
        applicableRange = sortedRanges[sortedRanges.length - 1];
        const lastRange = sortedRanges[sortedRanges.length - 1];
        const rangeMin = lastRange.min || 0;
        const rangeMax = lastRange.max || '∞';

        if (lastRange.amount !== undefined) {
          rangeDescription = `$${rangeMin}-${rangeMax} = $${lastRange.amount} fijo`;
        } else if (lastRange.percentage !== undefined) {
          rangeDescription = `$${rangeMin}-${rangeMax} = ${lastRange.percentage}%`;
        } else {
          rangeDescription = `$${rangeMin}-${rangeMax}`;
        }
      }

      if (applicableRange) {
        // Calcular monto por unidad
        let amountPerUnit = 0;

        if (applicableRange.amount !== undefined) {
          // Monto fijo por producto
          amountPerUnit = applicableRange.amount;
        } else if (applicableRange.percentage !== undefined) {
          // Porcentaje del precio
          amountPerUnit = (unitPrice * applicableRange.percentage) / 100;
        }

        // Calcular total para este producto (monto por unidad × cantidad)
        const totalProductAmount = amountPerUnit * quantity;
        baseAmount += totalProductAmount;

        productCalculations.push({
          productName: productDetail.productName,
          quantity,
          unitPrice,
          totalProductAmount,
          rangeApplied: rangeDescription,
          amountPerUnit,
        });
      }
    }

    if (baseAmount <= 0) {
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

    // 5. OBTENER WORKERS QUE APLICAN A ESTA REGLA
    let applicableWorkers: Worker[] = [];

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
        rule.distributeProfits = true;
      }
    }

    if (rule.distributeProfits) {
      // DISTRIBUTE_PROFITS = TRUE
      // Buscar todos los workers del mismo tipo que tengan asistencia
      const filters: any[] = [
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
            amount: baseAmount,
            currency: rule.paymentCurrency,
          },
        },
      };
    }

    // 6. OBTENER ACUMULADORES
    const workersWithAccumulators: Array<{
      worker: Worker;
      accumulator?: PaymentAccumulator;
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
        workersWithAccumulators.push({ worker, accumulator });
      } catch {
        workersWithAccumulators.push({ worker, accumulator: undefined });
      }
    }

    // 7. CALCULAR MONTO POR WORKER
    const amountPerWorker = baseAmount / applicableWorkers.length;
    const workerPayments: RealTimeWorkerPayment[] = [];

    for (const { worker, accumulator } of workersWithAccumulators) {
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
        workerId: worker.id as number,
        workerName:
          worker.user?.fullName ||
          `${worker.tempFirstName || ''} ${worker.tempLastName || ''}`.trim(),
        amount: amountPerWorker,
        currency: rule.paymentCurrency,
        roleInSale,
        calculationDetails: {
          baseAmount,
          distributedAmount: amountPerWorker,
          totalWorkers: applicableWorkers.length,
          totalProducts: productDetails.reduce((sum, p) => sum + p.quantity, 0),
          productCalculations: productCalculations.slice(0, 3), // Limitar a 3 productos para no hacer el objeto muy grande
          priceRanges: sortedRanges.map((r) => ({
            min: r.min,
            max: r.max,
            amount: r.amount,
            percentage: r.percentage,
            currency: r.currency,
          })),
        },
        accumulatorUpdate: {
          accumulatedAmount:
            (accumulator?.accumulatedAmount || 0) + amountPerWorker,
        },
      });
    }

    return {
      workerPayments,
      ruleSummary: {
        ruleId: rule.id as number,
        ruleName: rule.name,
        ruleType: rule.paymentType,
        totalAmount: baseAmount,
        totalWorkers: applicableWorkers.length,
        distributeProfitsApplied: rule.distributeProfits,
        baseCalculation: {
          amount: baseAmount,
          currency: rule.paymentCurrency,
        },
      },
    };
  }

  // Mantener métodos existentes para compatibilidad
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async calculateIncremental(context: any): Promise<any> {
    throw new Error('Use realTimeCalculate instead');
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async calculateBatch(context: any): Promise<any> {
    throw new Error('Use realTimeCalculate instead');
  }
}
