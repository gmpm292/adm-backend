import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePayrollPeriodInput } from '../dto/create-payroll-period.input';
import { UpdatePayrollPeriodInput } from '../dto/update-payroll-period.input';
import { BaseService } from '../../../../core/services/base.service';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { WorkerPaymentService } from '../../worker-payment/services/worker-payment.service';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';

@Injectable()
export class PayrollPeriodService extends BaseService<PayrollPeriod> {
  constructor(
    @InjectRepository(PayrollPeriod)
    private payrollPeriodRepository: Repository<PayrollPeriod>,
    @Inject(forwardRef(() => WorkerPaymentService))
    private workerPaymentService: WorkerPaymentService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(payrollPeriodRepository);
  }

  async create(
    createPayrollPeriodInput: CreatePayrollPeriodInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const payrollPeriod: PayrollPeriod = {
      ...createPayrollPeriodInput,
      isClosed: createPayrollPeriodInput.isClosed ?? false,
    } as PayrollPeriod;

    this.validatePeriodIntegrity(payrollPeriod);

    return super.baseCreate({
      data: payrollPeriod,
      uniqueFields: ['name'],
      cu,
      scopes,
      manager,
    });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
      cu,
      scopes,
      manager,
    });
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    return super.baseFindOne({
      id,
      relationsToLoad: { payments: true },
      cu,
      scopes,
      manager,
    });
  }

  async closePeriod(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const period = await super.baseFindOne({ id, cu, scopes, manager });
    if (!period) {
      throw new NotFoundError('Accounting period not found');
    }

    if (period.isClosed) {
      throw new Error('Accounting period is already closed');
    }

    // Verify all payments are processed
    const pendingPayments = (
      await this.workerPaymentService.find(
        {
          filters: [
            {
              property: 'payrollPeriod.id',
              operator: ConditionalOperator.EQUAL,
              value: id.toString(),
            },
            {
              property: 'paidDate',
              operator: ConditionalOperator.IS_NULL,
              value: '',
            },
          ],
          take: 0,
        },
        cu,
        scopes,
        manager,
      )
    ).totalCount;

    if (pendingPayments > 0) {
      throw new Error('Cannot close period with pending payments');
    }

    return super.baseUpdate({
      id,
      data: { ...period, isClosed: true },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updatePayrollPeriodInput: UpdatePayrollPeriodInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const period = await super.baseFindOne({ id, cu, scopes, manager });
    if (!period) {
      throw new NotFoundError();
    }

    if (period.isClosed) {
      throw new Error('Cannot modify closed accounting period');
    }

    return super.baseUpdate({
      id,
      data: { ...period, ...updatePayrollPeriodInput },
      cu,
      scopes,
      manager,
    });
  }

  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod[]> {
    const periods = await super.baseFindByIds({
      ids,
      relationsToLoad: { payments: true },
      cu,
      scopes,
      manager,
    });

    if (periods.length === 0) {
      throw new NotFoundError('No accounting periods found');
    }

    // Check if any period has payments
    const periodsWithPayments = periods.filter((p) => p.payments?.length > 0);
    if (periodsWithPayments.length > 0) {
      throw new Error(
        'Cannot delete accounting periods with associated payments',
      );
    }

    return super.baseDeleteMany({
      ids: periods.map((p) => p.id) as Array<number>,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    return super.baseRestoreDeletedMany({
      ids,
      cu,
      scopes,
      manager,
    });
  }

  async validatePeriod(
    payrollPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ) {
    // 1. Verificar que el período existe
    const payrollPeriod = await this.findOne(
      payrollPeriodId,
      cu,
      scopes,
      manager,
    );

    if (!payrollPeriod) {
      throw new NotFoundError('Payroll period not found');
    }

    // 2. Verificar que el período no esté cerrado
    if (payrollPeriod.isClosed) {
      throw new BadRequestError('Payroll period is already closed');
    }

    // 3. Validar fechas del período
    const today = new Date();
    if (payrollPeriod.endDate > today) {
      throw new BadRequestError('Payroll period has not ended yet');
    }

    // 4. Verificar que no haya pagos ya procesados para este período
    const existingPayments = (
      await this.workerPaymentService.find(
        {
          filters: [
            {
              property: 'payrollPeriod.id',
              operator: ConditionalOperator.EQUAL,
              value: payrollPeriodId.toString(),
            },
            {
              property: 'paidDate',
              operator: ConditionalOperator.IS_NULL,
              value: '',
            },
          ],
          take: 0,
        },
        cu,
        scopes,
        manager,
      )
    ).totalCount;

    if (existingPayments > 0) {
      throw new BadRequestError(
        `Payroll period already has ${existingPayments} processed payments.`,
      );
    }

    // 6. Verificar integridad de datos del período
    this.validatePeriodIntegrity(payrollPeriod);

    return payrollPeriod;
  }

  private validatePeriodIntegrity(payrollPeriod: PayrollPeriod) {
    // Verificar que startDate sea anterior a endDate
    if (payrollPeriod.startDate >= payrollPeriod.endDate) {
      throw new BadRequestError('Start date must be before end date');
    }

    // Verificar que el período no sea demasiado largo (ej: máximo 31 días)
    const daysDiff = Math.ceil(
      (payrollPeriod.endDate.getTime() - payrollPeriod.startDate.getTime()) /
        (1000 * 3600 * 24),
    );

    if (daysDiff > 31) {
      throw new BadRequestError('Payroll period cannot exceed 31 days');
    }
  }

  async getCurrentOrCreatePeriod(
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    if (!cu?.businessId) {
      throw new BadRequestError('User must be associated with a business');
    }

    // Buscar período existente que contenga la fecha
    const existingPeriod = await this.findPeriodForDate(
      date,
      cu,
      scopes,
      manager,
    );

    if (existingPeriod) {
      return existingPeriod;
    }

    // Buscar el último período del negocio
    const lastPeriod = await this.findLastPeriod(cu, scopes, manager);

    // Crear nuevo período
    return lastPeriod
      ? this.createPeriodAfter(lastPeriod, cu, scopes, manager)
      : this.createFirstPeriod(date, cu, scopes, manager);
  }

  async getNextOrCreatePeriod(
    currentPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    if (!cu?.businessId) {
      throw new BadRequestError('User must be associated with a business');
    }

    const currentPeriod = await this.baseFindOne({
      id: currentPeriodId,
      cu,
      scopes,
      manager,
    });

    if (!currentPeriod) {
      throw new NotFoundError('Current period not found');
    }

    // Buscar si ya existe el período siguiente
    const existingNextPeriod = await this.findPeriodAfterDate(
      currentPeriod.endDate,
      cu,
      scopes,
      manager,
    );

    if (existingNextPeriod) {
      return existingNextPeriod;
    }

    // Crear el período siguiente
    return this.createPeriodAfter(currentPeriod, cu, scopes, manager);
  }

  async getNextPeriod(
    currentPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    if (!cu?.businessId) {
      throw new BadRequestError('User must be associated with a business');
    }

    const currentPeriod = await this.baseFindOne({
      id: currentPeriodId,
      cu,
      scopes,
      manager,
    });

    if (!currentPeriod) {
      throw new NotFoundError('Current period not found');
    }

    const nextPeriod = await this.findPeriodAfterDate(
      currentPeriod.endDate,
      cu,
      scopes,
      manager,
    );

    if (!nextPeriod) {
      throw new NotFoundError('Next period not found');
    }

    return nextPeriod;
  }

  private async findPeriodForDate(
    date: Date,
    cu: JWTPayload,
    scopes: ScopedAccessEnum[] = [],
    manager?: EntityManager,
  ): Promise<PayrollPeriod | null> {
    const dateStr = date.toISOString().split('T')[0];

    const result = await super.baseFind({
      options: {
        filters: [
          {
            property: 'startDate',
            operator: ConditionalOperator.LESS_EQUAL_THAN,
            value: dateStr,
          },
          {
            property: 'endDate',
            operator: ConditionalOperator.GREATER_EQUAL_THAN,
            value: dateStr,
          },
        ],
        take: 1,
      },
      cu,
      scopes,
      manager,
    });

    return (result.data?.[0] as PayrollPeriod) || null;
  }

  private async findPeriodAfterDate(
    date: Date,
    cu: JWTPayload,
    scopes: ScopedAccessEnum[] = [],
    manager?: EntityManager,
  ): Promise<PayrollPeriod | null> {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    const result = await super.baseFind({
      options: {
        filters: [
          {
            property: 'startDate',
            operator: ConditionalOperator.GREATER_EQUAL_THAN,
            value: nextDayStr,
          },
        ],
        sorts: [{ property: 'startDate', direction: SortDirection.ASC }],
        take: 1,
      },
      cu,
      scopes,
      manager,
    });

    return (result.data?.[0] as PayrollPeriod) || null;
  }

  private async findLastPeriod(
    cu: JWTPayload,
    scopes: ScopedAccessEnum[] = [],
    manager?: EntityManager,
  ): Promise<PayrollPeriod | null> {
    const result = await super.baseFind({
      options: {
        sorts: [{ property: 'endDate', direction: SortDirection.DESC }],
        take: 1,
      },
      cu,
      scopes,
      manager,
    });

    return (result.data?.[0] as PayrollPeriod) || null;
  }

  private createFirstPeriod(
    referenceDate: Date,
    cu: JWTPayload,
    scopes: ScopedAccessEnum[] = [],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    // Crear primer período de 7 días terminando en la fecha de referencia
    const endDate = new Date(referenceDate);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);

    const name = this.generatePeriodName(startDate, endDate);

    const createInput: CreatePayrollPeriodInput = {
      startDate,
      endDate,
      name,
      description: `First payroll period from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      businessId: cu.businessId!,
    };

    return this.create(createInput, cu, scopes, manager);
  }

  private async createPeriodAfter(
    previousPeriod: PayrollPeriod,
    cu: JWTPayload,
    scopes: ScopedAccessEnum[] = [],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const daysDiff = Math.ceil(
      (previousPeriod.endDate.getTime() - previousPeriod.startDate.getTime()) /
        (1000 * 3600 * 24),
    );

    const startDate = new Date(previousPeriod.endDate);
    startDate.setDate(startDate.getDate() + 1);

    const endDate = new Date(startDate);

    if (daysDiff >= 28 && daysDiff <= 31) {
      // Mensual - siguiente mes
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() - 1);
    } else if (daysDiff >= 14 && daysDiff <= 16) {
      // Quincenal - 14 días
      endDate.setDate(endDate.getDate() + 14);
    } else {
      // Semanal - 7 días
      endDate.setDate(endDate.getDate() + 6);
    }

    const name = this.generatePeriodName(startDate, endDate);

    const createInput: CreatePayrollPeriodInput = {
      startDate,
      endDate,
      name,
      description: `Payroll period from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      businessId: cu.businessId!,
    };

    return this.create(createInput, cu, scopes, manager);
  }

  private generatePeriodName(startDate: Date, endDate: Date): string {
    const formatDate = (date: Date): string => {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    };

    return `${formatDate(startDate)} / ${formatDate(endDate)}`;
  }
}
