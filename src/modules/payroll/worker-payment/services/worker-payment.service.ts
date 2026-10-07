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
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { PaymentMethod } from '../enums/payment-method.enum';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { WorkerService } from '../../worker/services/worker.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { CurrencyService } from '../../currency/services/currency.service';
import { Sale } from '../../../sales/sale/entities/sale.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';

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
    const { workerId, payrollPeriodId, saleId, paymentRuleId, ...rest } =
      createWorkerPaymentInput;
    const [worker, payrollPeriod] = await Promise.all([
      this.workerService.findOne(workerId, cu, scopes, manager),
      this.payrollPeriodService.findOne(payrollPeriodId, cu, scopes, manager),
    ]);
    if (payrollPeriod.isClosed) {
      throw new BadRequestError(
        'El período está cerrado: no admite pagos nuevos',
      );
    }
    if (!(createWorkerPaymentInput.amount > 0)) {
      throw new BadRequestError('El importe debe ser mayor que cero');
    }
    const currency = await this.validCurrency(
      createWorkerPaymentInput.currency,
    );

    const workerPayment: WorkerPayment = {
      ...rest,
      worker,
      payrollPeriod,
      sale: saleId ? ({ id: saleId } as Sale) : null,
      paymentRule: paymentRuleId
        ? ({ id: paymentRuleId } as PaymentRule)
        : null,
      exchangeRate:
        createWorkerPaymentInput.exchangeRate || currency.exchangeRateToCUP,
      // El pago es del lugar del trabajador
      business: worker.business,
      office: worker.office,
      department: worker.department,
      team: worker.team,
    } as WorkerPayment;

    return super.baseCreate({
      data: workerPayment,
      cu,
      scopes,
      manager,
    });
  }

  /** La moneda existe y está activa */
  private async validCurrency(code: string) {
    const currency = await this.currencyService
      .findByCode(code)
      .catch(() => null);
    if (!currency) {
      throw new BadRequestError(`La moneda ${code} no existe`);
    }
    return currency;
  }

  /** Marca pagos como hechos, todos o ninguno */
  async markAsPaid(
    ids: number[],
    paidDate: Date | undefined,
    paymentMethod: PaymentMethod | undefined,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment[]> {
    if (!manager) {
      return this.workerPaymentRepository.manager.transaction((txManager) =>
        this.markAsPaid(ids, paidDate, paymentMethod, cu, scopes, txManager),
      );
    }
    const payments = await super.baseFindByIds({
      ids,
      relationsToLoad: { payrollPeriod: true },
      cu,
      scopes,
      manager,
    });
    if (payments.some((p) => p.payrollPeriod?.isClosed)) {
      throw new BadRequestError('Hay pagos de un período cerrado');
    }
    const updated: WorkerPayment[] = [];
    for (const payment of payments.filter((p) => !p.paidDate)) {
      updated.push(
        await super.baseUpdate({
          id: payment.id as number,
          data: {
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            ...(paymentMethod && { paymentMethod }),
          },
          cu,
          scopes,
          manager,
        }),
      );
    }
    return updated;
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
        'worker.user',
        'payrollPeriod',
        'paymentRule',
        'sale',
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
  ): Promise<WorkerPayment> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        worker: { user: true },
        payrollPeriod: true,
        paymentRule: true,
        sale: true,
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

  async findByWorker(
    workerId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment[]> {
    await this.workerService.findOne(workerId, cu, scopes, manager);
    return this.workerPaymentRepository.find({
      where: { worker: { id: workerId } },
      relations: ['worker', 'payrollPeriod', 'paymentRule'],
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
      relations: ['worker', 'payrollPeriod', 'paymentRule'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Un pago hecho solo admite notas o deshacer el pago (`paidDate: null`);
   * los de un período cerrado no se tocan.
   */
  async update(
    id: number,
    updateWorkerPaymentInput: UpdateWorkerPaymentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment> {
    const workerPayment = await super.baseFindOne({
      id,
      relationsToLoad: { payrollPeriod: true },
      cu,
      scopes,
      manager,
    });
    if (workerPayment.payrollPeriod?.isClosed) {
      throw new BadRequestError('El período del pago está cerrado');
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      id: _id,
      workerId,
      payrollPeriodId,
      saleId,
      paymentRuleId,
      ...rest
    } = updateWorkerPaymentInput;
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const changesMoney = [
      workerId,
      payrollPeriodId,
      rest.amount,
      rest.currency,
      rest.paymentConcept,
    ].some((value) => value !== undefined);
    const stillPaid = rest.paidDate !== null && !!workerPayment.paidDate;
    if (changesMoney && stillPaid) {
      throw new BadRequestError(
        'Un pago ya hecho no se modifica: quita antes la fecha de pago',
      );
    }

    const data: Partial<WorkerPayment> = { ...rest } as Partial<WorkerPayment>;
    if (rest.amount !== undefined && !(rest.amount > 0)) {
      throw new BadRequestError('El importe debe ser mayor que cero');
    }
    if (rest.currency) await this.validCurrency(rest.currency);
    if (workerId) {
      data.worker = await this.workerService.findOne(
        workerId,
        cu,
        scopes,
        manager,
      );
    }
    if (payrollPeriodId) {
      const period = await this.payrollPeriodService.findOne(
        payrollPeriodId,
        cu,
        scopes,
        manager,
      );
      if (period.isClosed) {
        throw new BadRequestError('Ese período está cerrado');
      }
      data.payrollPeriod = period;
    }

    return super.baseUpdate({
      id,
      data,
      cu,
      scopes,
      manager,
    });
  }

  /** Solo pagos pendientes de períodos abiertos */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkerPayment[]> {
    const payments = await super.baseFindByIds({
      ids,
      relationsToLoad: { payrollPeriod: true },
      cu,
      scopes,
      manager,
    });
    if (payments.some((p) => p.paidDate)) {
      throw new BadRequestError('Un pago ya hecho no se elimina');
    }
    if (payments.some((p) => p.payrollPeriod?.isClosed)) {
      throw new BadRequestError('Un pago de un período cerrado no se elimina');
    }
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
