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
import { BusinessService } from '../../../../company/business/services/business.service';
import { OfficeService } from '../../../../company/office/services/office.service';
import { DepartmentService } from '../../../../company/department/services/department.service';
import { TeamService } from '../../../../company/team/services/team.service';
import { ProcessPeriodPaymentsInput } from '../../dto/process-payments.input';
import { PayrollPeriod } from '../../../payroll-period/entities/payroll-period.entity';
import { PeriodBatchCalculationResult } from '../../types/payment-calculation.types';
import { ListFilter } from '../../../../../core/graphql/remote-operations';
import { LogicalOperator } from '../../../../../core/graphql/remote-operations/enums/logical-operator.enum';

@Injectable()
export class FixedAmountProcessor extends BasePaymentProcessor {
  protected readonly supportedPaymentType = PaymentType.FIXED_AMOUNT;

  constructor(
    private readonly workerService: WorkerService,
    private readonly businessService: BusinessService,
    private readonly officeService: OfficeService,
    private readonly departmentService: DepartmentService,
    private readonly teamService: TeamService,
  ) {
    super();
  }

  /**
   * Calcular pagos batch para un período completo
   */
  async calculateBatchForPeriod(
    rule: PaymentRule,
    input: ProcessPeriodPaymentsInput,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PeriodBatchCalculationResult> {
    console.log(
      `[FixedAmountProcessor] Calculando batch para regla ${rule.name}`,
    );

    // 1. Obtener workers que aplican a esta regla
    const applicableWorkers = await this.getWorkersForRule(
      rule,
      input,
      cu,
      scopes,
      manager,
    );

    if (applicableWorkers.length === 0) {
      console.log(
        `[FixedAmountProcessor] No hay workers aplicables para la regla ${rule.name}`,
      );
      return {
        workerPayments: [],
        totalAmount: 0,
        totalWorkers: 0,
      };
    }

    console.log(
      `[FixedAmountProcessor] ${applicableWorkers.length} workers aplicables encontrados`,
    );

    // 2. Calcular monto base de la regla
    const fixedAmount = rule.conditions.fixedAmount?.amount || 0;
    const currency = rule.paymentCurrency || 'CUP';

    if (fixedAmount <= 0) {
      throw new Error(`La regla ${rule.name} no tiene un monto fijo válido`);
    }

    // 3. Calcular multiplicador según scope
    let multiplier = 1;
    let unitType = 'WORKER';
    let scopeDetails = {};

    // Obtener businessId del primer worker o del input
    const businessId = applicableWorkers[0]?.business?.id || input.businessId;

    if (!businessId) {
      throw new Error(
        'No se pudo determinar el business para cálculo de scope',
      );
    }

    switch (rule.scope) {
      case ScopedAccessEnum.BUSINESS:
        multiplier = 1;
        unitType = 'BUSINESS';
        scopeDetails = { businessId };
        break;

      case ScopedAccessEnum.OFFICE: {
        const officeCount = await this.getUnitCount(
          'office',
          businessId,
          input.officeId,
          cu,
          scopes,
          manager,
        );
        multiplier = officeCount;
        unitType = 'OFFICE';
        scopeDetails = { businessId, officeCount };
        break;
      }

      case ScopedAccessEnum.DEPARTMENT: {
        const departmentCount = await this.getUnitCount(
          'department',
          businessId,
          input.departmentId,
          cu,
          scopes,
          manager,
        );
        multiplier = departmentCount;
        unitType = 'DEPARTMENT';
        scopeDetails = { businessId, departmentCount };
        break;
      }

      case ScopedAccessEnum.TEAM: {
        const teamCount = await this.getUnitCount(
          'team',
          businessId,
          input.teamId,
          cu,
          scopes,
          manager,
        );
        multiplier = teamCount;
        unitType = 'TEAM';
        scopeDetails = { businessId, teamCount };
        break;
      }

      default:
        multiplier = 1;
        unitType = 'WORKER';
    }

    // 4. Calcular monto final por worker
    const finalAmountPerWorker = fixedAmount * multiplier;
    const workerPayments: PeriodBatchCalculationResult['workerPayments'] = [];
    let totalAmount = 0;

    for (const worker of applicableWorkers) {
      workerPayments.push({
        workerId: worker.id as number,
        workerName:
          worker.tempFirstName ?? worker.user?.name ?? `Worker ${worker.id}`,
        amount: finalAmountPerWorker,
        currency,
        calculationDetails: {
          fixedAmount,
          multiplier,
          unitType,
          scope: rule.scope,
          finalAmount: finalAmountPerWorker,
          currency,
          payrollPeriodId: payrollPeriod.id,
          periodStart: payrollPeriod.startDate,
          periodEnd: payrollPeriod.endDate,
          businessId,
          ...scopeDetails,
        },
      });

      totalAmount += finalAmountPerWorker;
    }

    console.log(
      `[FixedAmountProcessor] Cálculo completado: ${workerPayments.length} pagos, total: ${totalAmount} ${currency}`,
    );

    return {
      workerPayments, // ← Ahora coincide con PeriodBatchCalculationResult
      totalAmount,
      totalWorkers: workerPayments.length,
    };
  }

  /**
   * Obtener workers que aplican a una regla específica
   */
  private async getWorkersForRule(
    rule: PaymentRule,
    input: ProcessPeriodPaymentsInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Worker[]> {
    const filters: ListFilter[] = [
      {
        property: 'workerType',
        operator: ConditionalOperator.EQUAL,
        value: rule.workerType,
      },
    ];

    // Filtro por otherType si aplica
    if (rule.workerType === WorkerType.OTHER && rule.otherType) {
      filters.push({
        property: 'otherType',
        operator: ConditionalOperator.EQUAL,
        value: rule.otherType,
      });
    }

    // Filtros de scope jerárquico
    if (input.businessId) {
      filters.push({
        property: 'business.id',
        operator: ConditionalOperator.EQUAL,
        value: String(input.businessId),
      });
    }

    if (input.officeId) {
      filters.push({
        property: 'office.id',
        operator: ConditionalOperator.EQUAL,
        value: String(input.officeId),
      });
    }

    if (input.departmentId) {
      filters.push({
        property: 'department.id',
        operator: ConditionalOperator.EQUAL,
        value: String(input.departmentId),
      });
    }

    if (input.teamId) {
      filters.push({
        property: 'team.id',
        operator: ConditionalOperator.EQUAL,
        value: String(input.teamId),
      });
    }

    // Filtro específico por workerIds si está definido
    if (input.workerIds && input.workerIds.length > 0) {
      const workerIdsFilters: ListFilter[] = [];
      for (const id of input.workerIds) {
        workerIdsFilters.push({
          property: 'id',
          operator: ConditionalOperator.EQUAL,
          value: String(id),
          logicalOperator: LogicalOperator.OR,
        });
      }
      filters.push({ filters: workerIdsFilters });
    }

    const workersResult = await this.workerService.find(
      { filters },
      cu,
      scopes,
      manager,
    );

    return workersResult.data as Worker[];
  }

  /**
   * Obtener conteo de unidades organizativas
   */
  private async getUnitCount(
    unitType: 'office' | 'department' | 'team',
    businessId: number,
    specificId?: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    const filters: any[] = [
      {
        property: 'business.id',
        operator: ConditionalOperator.EQUAL,
        value: String(businessId),
      },
    ];

    // Si hay un ID específico, contar solo ese
    if (specificId) {
      filters.push({
        property: 'id',
        operator: ConditionalOperator.EQUAL,
        value: String(specificId),
      });
    }

    let service: any;
    switch (unitType) {
      case 'office':
        service = this.officeService;
        break;
      case 'department':
        service = this.departmentService;
        break;
      case 'team':
        service = this.teamService;
        break;
      default:
        throw new Error(`Tipo de unidad no soportado: ${String(unitType)}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const { totalCount } = await service.find(
      { filters, take: 0 }, // take: 0 para solo obtener count
      cu,
      scopes,
      manager,
    );

    return totalCount as number;
  }
}
