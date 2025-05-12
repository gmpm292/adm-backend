import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateWorkerInput } from '../dto/create-worker.input';
import { UpdateWorkerInput } from '../dto/update-worker.input';
import { BaseService } from '../../../../core/services/base.service';
import { Worker } from '../entities/worker.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { PaymentRuleService } from '../../payment-rule/services/payment-rule.service';
import { OfficeService } from '../../../company/office/services/office.service';
import { UsersService } from '../../../users/services/users.service';

@Injectable()
export class WorkerService extends BaseService<Worker> {
  constructor(
    @InjectRepository(Worker)
    private workerRepository: Repository<Worker>,
    private userService: UsersService,
    @Inject(forwardRef(() => PaymentRuleService))
    private paymentRuleService: PaymentRuleService,
    @Inject(forwardRef(() => OfficeService))
    private officeService: OfficeService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(workerRepository);
  }

  async create(
    createWorkerInput: CreateWorkerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Worker> {
    await createWorkerInput.validateCustomRules(cu as JWTPayload);

    const [user, paymentRule, office] = await Promise.all([
      this.userService.findOne(
        createWorkerInput.userId as number,
        undefined,
        cu,
        scopes,
        manager,
      ),
      createWorkerInput.paymentRuleId
        ? this.paymentRuleService.findOne(
            createWorkerInput.paymentRuleId,
            cu,
            scopes,
            manager,
          )
        : Promise.resolve(undefined),
      createWorkerInput.officeId
        ? this.officeService.findOne(
            createWorkerInput.officeId,
            cu,
            scopes,
            manager,
          )
        : Promise.resolve(undefined),
    ]);

    // if (!user) {
    //   throw new NotFoundError('User not found');
    // }

    const worker: Worker = {
      ...createWorkerInput,
      user,
      paymentRule,
      office,
      baseSalary: createWorkerInput.baseSalary || 0,
    } as Worker;

    return super.baseCreate({
      data: worker,
      uniqueFields: ['user'],
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
      relationsToLoad: ['user', 'paymentRule', 'office'],
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
  ): Promise<Worker> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        user: true,
        paymentRule: true,
        office: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findByOffice(
    officeId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Worker[]> {
    await this.officeService.findOne(officeId, cu, scopes, manager);
    return this.workerRepository.find({
      where: { office: { id: officeId } },
      relations: ['user', 'paymentRule', 'office'],
    });
  }

  async update(
    id: number,
    updateWorkerInput: UpdateWorkerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Worker> {
    const worker = await super.baseFindOne({ id, cu, scopes, manager });
    if (!worker) {
      throw new NotFoundError();
    }

    if (updateWorkerInput.userId) {
      const user = await this.userService.findOne(
        updateWorkerInput.userId,
        undefined,
        cu,
        scopes,
        manager,
      );
      if (!user) {
        throw new NotFoundError('User not found');
      }
      worker.user = user;
    }

    if (updateWorkerInput.paymentRuleId) {
      const paymentRule = await this.paymentRuleService.findOne(
        updateWorkerInput.paymentRuleId,
        cu,
        scopes,
        manager,
      );
      worker.paymentRule = paymentRule;
    }

    if (updateWorkerInput.officeId) {
      const office = await this.officeService.findOne(
        updateWorkerInput.officeId,
        cu,
        scopes,
        manager,
      );
      worker.office = office;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId, paymentRuleId, officeId, ...rest } = updateWorkerInput;
    return super.baseUpdate({
      id,
      data: { ...worker, ...rest },
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
  ): Promise<Worker[]> {
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
