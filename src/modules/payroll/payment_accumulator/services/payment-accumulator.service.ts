/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, EntityManager, Repository } from 'typeorm';
import { CreatePaymentAccumulatorInput } from '../dto/create-payment-accumulator.input';
import { UpdatePaymentAccumulatorInput } from '../dto/update-payment-accumulator.input';
import { BaseService } from '../../../../core/services/base.service';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { PaymentAccumulator } from '../entities/payment_accumulator.entity';
import { WorkerService } from '../../worker/services/worker.service';
import { PaymentRuleService } from '../../payment-rule/services/payment-rule.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';

@Injectable()
export class PaymentAccumulatorService extends BaseService<PaymentAccumulator> {
  constructor(
    @InjectRepository(PaymentAccumulator)
    private paymentAccumulatorRepository: Repository<PaymentAccumulator>,
    private workerService: WorkerService,
    private paymentRuleService: PaymentRuleService,
    private payrollPeriodService: PayrollPeriodService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(paymentAccumulatorRepository);
  }

  async create(
    createPaymentAccumulatorInput: CreatePaymentAccumulatorInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentAccumulator> {
    const { workerId, paymentRuleId, payrollPeriodId, ...rest } =
      createPaymentAccumulatorInput;

    // Validar referencias
    const [worker, paymentRule, payrollPeriod] = await Promise.all([
      this.workerService.findOne(workerId, cu, scopes, manager),
      this.paymentRuleService.findOne(paymentRuleId, cu, scopes, manager),
      this.payrollPeriodService.findOne(payrollPeriodId, cu, scopes, manager),
    ]);

    if (!worker) throw new NotFoundError('Worker not found');
    if (!paymentRule) throw new NotFoundError('PaymentRule not found');
    if (!payrollPeriod) throw new NotFoundError('PayrollPeriod not found');

    // Validar unicidad
    await this.validateUniquePaymentAccumulator(
      createPaymentAccumulatorInput,
      cu,
      scopes,
      manager,
    );

    const paymentAccumulator: DeepPartial<PaymentAccumulator> = {
      ...rest,
      worker: { id: workerId },
      paymentRule: { id: paymentRuleId },
      payrollPeriod: { id: payrollPeriodId },
      business: worker.business,
      office: worker.office,
      department: worker.department,
      team: worker.team,
    };

    return super.baseCreate({
      data: paymentAccumulator,
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
      relationsToLoad: [
        'worker',
        'paymentRule',
        'payrollPeriod',
        'business',
        'office',
        'department',
        'team',
      ],
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
  ): Promise<PaymentAccumulator> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        worker: true,
        paymentRule: true,
        payrollPeriod: true,
        business: true,
        office: true,
        department: true,
        team: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updatePaymentAccumulatorInput: UpdatePaymentAccumulatorInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentAccumulator> {
    const { workerId, paymentRuleId, payrollPeriodId, ...rest } =
      updatePaymentAccumulatorInput;
    const paymentAccumulator = await super.baseFindOne({
      id,
      cu,
      scopes,
      manager,
    });

    if (!paymentAccumulator) {
      throw new NotFoundError('PaymentAccumulator not found');
    }

    // Validar referencias si se proporcionan
    let worker, paymentRule, payrollPeriod;
    if (workerId) {
      worker = await this.workerService.findOne(workerId, cu, scopes, manager);
      if (!worker) throw new NotFoundError('Worker not found');
    }

    if (paymentRuleId) {
      paymentRule = await this.paymentRuleService.findOne(
        paymentRuleId,
        cu,
        scopes,
        manager,
      );
      if (!paymentRule) throw new NotFoundError('PaymentRule not found');
    }

    if (payrollPeriodId) {
      payrollPeriod = await this.payrollPeriodService.findOne(
        payrollPeriodId,
        cu,
        scopes,
        manager,
      );
      if (!payrollPeriod) throw new NotFoundError('PayrollPeriod not found');
    }

    const updateData: DeepPartial<PaymentAccumulator> = {
      ...rest,
      worker: workerId ? { id: workerId } : paymentAccumulator.worker,
      paymentRule: paymentRuleId
        ? { id: paymentRuleId }
        : paymentAccumulator.paymentRule,
      payrollPeriod: payrollPeriodId
        ? { id: payrollPeriodId }
        : paymentAccumulator.payrollPeriod,
      business: worker?.business || paymentAccumulator.business,
      office: worker?.office || paymentAccumulator.office,
      department: worker?.department || paymentAccumulator.department,
      team: worker?.team || paymentAccumulator.team,
    };

    return super.baseUpdate({
      id,
      data: updateData,
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
  ): Promise<PaymentAccumulator[]> {
    return super.baseDeleteMany({
      ids,
      cu,
      scopes,
      softRemove: true,
      manager,
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

  async validateUniquePaymentAccumulator(
    createInput: CreatePaymentAccumulatorInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    const dataInDB = await this.baseFind({
      options: {
        take: 0,
        filters: [
          {
            property: 'worker.id',
            operator: ConditionalOperator.EQUAL,
            value: createInput.workerId.toString(),
          },
          {
            property: 'paymentRule.id',
            operator: ConditionalOperator.EQUAL,
            value: createInput.paymentRuleId.toString(),
          },
          {
            property: 'payrollPeriod.id',
            operator: ConditionalOperator.EQUAL,
            value: createInput.payrollPeriodId.toString(),
          },
        ],
      },
      relationsToLoad: ['worker', 'paymentRule', 'payrollPeriod'],
      cu,
      scopes,
      manager,
    });

    if (dataInDB.totalCount > 0) {
      throw new ConflictError(
        'PaymentAccumulator already exists for this worker, payment rule, and payroll period',
      );
    }

    return true;
  }

  async findByWorkerAndPeriod(
    workerId: number,
    payrollPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentAccumulator[]> {
    const result = await this.baseFind({
      options: {
        filters: [
          {
            property: 'worker.id',
            operator: ConditionalOperator.EQUAL,
            value: workerId.toString(),
          },
          {
            property: 'payrollPeriod.id',
            operator: ConditionalOperator.EQUAL,
            value: payrollPeriodId.toString(),
          },
        ],
      },
      relationsToLoad: ['paymentRule', 'worker', 'payrollPeriod'],
      cu,
      scopes,
      manager,
    });

    return result.data as PaymentAccumulator[];
  }
}
