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
}
