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
import { CreateUserInput } from '../../../users/dto/create-user.input';
import { Role } from '../../../../core/enums/role.enum';
import { User } from '../../../users/entities/user.entity';

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
      createWorkerInput.userId
        ? this.userService.findOne(
            createWorkerInput.userId,
            undefined,
            cu,
            scopes,
            manager,
          )
        : Promise.resolve(undefined),
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

    // CAMBIO PRINCIPAL: Crear usuario si no existe pero hay datos temporales
    let createdUser: User | undefined;
    if (!user && this.hasUserCreationData(createWorkerInput)) {
      createdUser = await this.createUserFromWorkerData(
        createWorkerInput,
        cu,
        scopes,
        manager,
      );
    }

    // Validar que si se proporcionó userId, el usuario debe existir
    if (createWorkerInput.userId && !user) {
      throw new NotFoundError('User not found');
    }

    const workerData: Partial<Worker> = {
      ...createWorkerInput,
      user: user || createdUser,
      paymentRule,
      office,
      baseSalary: createWorkerInput.baseSalary || 0,
    };

    // Si se creó un usuario, limpiar campos temporales
    if (createdUser) {
      workerData.tempFirstName = undefined;
      workerData.tempLastName = undefined;
      workerData.tempEmail = undefined;
      workerData.tempPhone = undefined;
      workerData.tempRole = [];
    }

    return super.baseCreate({
      data: workerData as Worker,
      uniqueFields: ['user'],
      cu,
      scopes,
      manager,
    });
  }

  // CAMBIO: Método para verificar si hay datos para crear usuario
  private hasUserCreationData(input: CreateWorkerInput): boolean {
    return !!(input.tempEmail && input.tempFirstName && input.tempLastName);
  }

  // CAMBIO: Método para crear usuario desde datos temporales
  private async createUserFromWorkerData(
    input: CreateWorkerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<User> {
    const createUserInput: CreateUserInput = {
      name: input.tempFirstName!,
      lastName: input.tempLastName!,
      email: input.tempEmail!,
      mobile: input.tempPhone || '',
      role:
        input.tempRole && input.tempRole.length > 0
          ? input.tempRole
          : [input.role || Role.AGENT],
      businessId: input.businessId,
      officeId: input.officeId,
      departmentId: input.departmentId,
      teamId: input.teamId,
      enabled: true,
    };

    return this.userService.create(createUserInput, cu /*scopes, manager*/);
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

    // CAMBIO: Manejar actualización de usuario
    if (updateWorkerInput.userId !== undefined) {
      if (updateWorkerInput.userId === null) {
        // Permitir desasociar usuario
        worker.user = undefined;
      } else {
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

        // Limpiar campos temporales si se asocia un usuario
        worker.tempFirstName = undefined;
        worker.tempLastName = undefined;
        worker.tempEmail = undefined;
        worker.tempPhone = undefined;
        worker.tempRole = [];
      }
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

  // CAMBIO: Nuevo método para asociar usuario existente a worker
  async associateUser(
    workerId: number,
    userId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Worker> {
    const worker = await this.findOne(workerId, cu, scopes, manager);
    const user = await this.userService.findOne(
      userId,
      undefined,
      cu,
      scopes,
      manager,
    );

    if (!worker) {
      throw new NotFoundError('Worker not found');
    }
    if (!user) {
      throw new NotFoundError('User not found');
    }

    worker.user = user;
    // Limpiar campos temporales
    worker.tempFirstName = undefined;
    worker.tempLastName = undefined;
    worker.tempEmail = undefined;
    worker.tempPhone = undefined;
    worker.tempRole = [];

    return this.workerRepository.save(worker);
  }

  // CAMBIO: Nuevo método para crear usuario desde worker existente
  async createUserFromWorker(
    workerId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Worker> {
    const worker = await this.findOne(workerId, cu, scopes, manager);
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    if (worker.user) {
      throw new NotFoundError('Worker already has a user associated');
    }

    if (!worker.tempEmail || !worker.tempFirstName || !worker.tempLastName) {
      throw new NotFoundError(
        'Worker does not have enough data to create user',
      );
    }

    const user = await this.createUserFromWorkerData(
      {
        tempEmail: worker.tempEmail,
        tempFirstName: worker.tempFirstName,
        tempLastName: worker.tempLastName,
        tempPhone: worker.tempPhone,
        tempRole: worker.tempRole,
        role: worker.tempRole?.[0] || Role.AGENT,
        businessId: worker.business?.id,
        officeId: worker.office?.id,
        departmentId: worker.department?.id,
        teamId: worker.team?.id,
      } as CreateWorkerInput,
      cu,
      scopes,
      manager,
    );

    worker.user = user;
    // Limpiar campos temporales
    worker.tempFirstName = undefined;
    worker.tempLastName = undefined;
    worker.tempEmail = undefined;
    worker.tempPhone = undefined;
    worker.tempRole = [];

    return this.workerRepository.save(worker);
  }
}
