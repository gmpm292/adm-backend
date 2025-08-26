import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateWorkerPaymentInput } from '../dto/create-worker-payment.input';
import { UpdateWorkerPaymentInput } from '../dto/update-worker-payment.input';
import { BaseService } from '../../../../core/services/base.service';
import { WorkerPayment } from '../entities/worker-payment.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { WorkerService } from '../../worker/services/worker.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { CurrencyService } from '../../currency/services/currency.service';

@Injectable()
export class WorkerPaymentService extends BaseService<WorkerPayment> {
  constructor(
    @InjectRepository(WorkerPayment)
    private workerPaymentRepository: Repository<WorkerPayment>,
    @Inject(forwardRef(() => WorkerService))
    private workerService: WorkerService,
    @Inject(forwardRef(() => PayrollPeriodService))
    private payrollPeriodService: PayrollPeriodService,
    private currencyService: CurrencyService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(workerPaymentRepository);
  }

  async create(
    createWorkerPaymentInput: CreateWorkerPaymentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment> {
    const { workerId, payrollPeriodId, ...rest } = createWorkerPaymentInput;
    const [worker, payrollPeriod] = await Promise.all([
      this.workerService.findOne(workerId, cu, scopes, manager),
      this.payrollPeriodService.findOne(payrollPeriodId, cu, scopes, manager),
    ]);

    if (!worker) {
      throw new NotFoundError('Worker not found');
    }
    if (!payrollPeriod) {
      throw new NotFoundError('Accounting period not found');
    }

    // Verify currency is valid
    const currency = await this.currencyService.findByCode(
      createWorkerPaymentInput.currency,
    );
    if (!currency) {
      throw new NotFoundError('Invalid currency');
    }

    const workerPayment: WorkerPayment = {
      ...rest,
      worker,
      payrollPeriod,
      exchangeRate:
        createWorkerPaymentInput.exchangeRate || currency.exchangeRateToCUP,
    } as WorkerPayment;

    return super.baseCreate({
      data: workerPayment,
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
      relationsToLoad: ['worker', 'payrollPeriod'],
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
  ): Promise<WorkerPayment> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        worker: true,
        payrollPeriod: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findByWorker(
    workerId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment[]> {
    await this.workerService.findOne(workerId, cu, scopes, manager);
    return this.workerPaymentRepository.find({
      where: { worker: { id: workerId } },
      relations: ['worker', 'payrollPeriod'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByPeriod(
    periodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment[]> {
    await this.payrollPeriodService.findOne(periodId, cu, scopes, manager);
    return this.workerPaymentRepository.find({
      where: { payrollPeriod: { id: periodId } },
      relations: ['worker', 'payrollPeriod'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: number,
    updateWorkerPaymentInput: UpdateWorkerPaymentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment> {
    const workerPayment = await super.baseFindOne({ id, cu, scopes, manager });
    if (!workerPayment) {
      throw new NotFoundError();
    }

    if (updateWorkerPaymentInput.workerId) {
      const worker = await this.workerService.findOne(
        updateWorkerPaymentInput.workerId,
        cu,
        scopes,
        manager,
      );
      if (!worker) {
        throw new NotFoundError('Worker not found');
      }
      workerPayment.worker = worker;
    }

    if (updateWorkerPaymentInput.payrollPeriodId) {
      const payrollPeriod = await this.payrollPeriodService.findOne(
        updateWorkerPaymentInput.payrollPeriodId,
        cu,
        scopes,
        manager,
      );
      if (!payrollPeriod) {
        throw new NotFoundError('Accounting period not found');
      }
      workerPayment.payrollPeriod = payrollPeriod;
    }

    if (updateWorkerPaymentInput.currency) {
      const currency = await this.currencyService.findByCode(
        updateWorkerPaymentInput.currency,
      );
      if (!currency) {
        throw new NotFoundError('Invalid currency');
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { workerId, payrollPeriodId, ...rest } = updateWorkerPaymentInput;
    return super.baseUpdate({
      id,
      data: { ...workerPayment, ...rest },
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
  ): Promise<WorkerPayment[]> {
    return super.baseDeleteMany({
      ids,
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
}
