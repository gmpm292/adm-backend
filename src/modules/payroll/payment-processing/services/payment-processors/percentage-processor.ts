import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BasePaymentProcessor } from './base-processor';

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
import {
  RealTimeCalculationResult,
  RealTimeWorkerPayment,
} from '../../types/real-time-calculation.types';
import { PaymentAccumulator } from '../../../payment_accumulator/entities/payment_accumulator.entity';
import { Attendance } from '../../../attendance/entities/attendance.entity';
import { AttendanceStatus } from '../../../attendance/enums/attendance-status.enum';

@Injectable()
export class PercentageProcessor extends BasePaymentProcessor {
  protected readonly supportedPaymentType = PaymentType.PERCENTAGE;

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

    const percentage = rule.conditions.percentage?.percentage || 0;
    const saleAmount = sale.totalAmount || 0;
    const saleDate = sale.effectiveDate || new Date();

    // 2. CALCULAR PORCENTAJE DE BENEFICIO
    const baseAmount = (saleAmount * percentage) / 100;
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

    // 3. OBTENER WORKERS QUE APLICAN A ESTA REGLA
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

      // Aplicar filtros de scope si es necesario (simplificado por ahora)
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

    // 4. OBTENER ACUMULADORES
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

    // 5. CALCULAR MONTO POR WORKER
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
          percentage,
          saleAmount,
        },
        accumulatorUpdate: {
          salesTotal:
            (accumulator?.salesTotal || 0) +
            saleAmount / applicableWorkers.length,
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
}
