/* eslint-disable @typescript-eslint/no-unused-vars */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateWorkerInput } from '../dto/create-worker.input';
import { UpdateWorkerInput } from '../dto/update-worker.input';
import { BaseService } from '../../../../core/services/base.service';
import { Worker } from '../entities/worker.entity';
import {
  ListFilter,
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
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { WorkerType } from '../enums/worker-type.enum';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../../core/graphql/remote-operations/enums/logical-operator.enum';

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
    externalManager?: EntityManager,
  ): Promise<Worker> {
    this.checkWorkerInformation(createWorkerInput, {
      role: cu?.role ?? [],
    });

    // Función interna que contiene toda la lógica de creación
    const createWorkerTransaction = async (
      manager: EntityManager,
    ): Promise<Worker> => {
      const [user, paymentRule, office] = await Promise.all([
        createWorkerInput.userId
          ? this.userService.findOne(
              createWorkerInput.userId,
              undefined,
              cu,
              scopes,
              manager, // Pasar el manager de la transacción
            )
          : Promise.resolve(undefined),
        createWorkerInput.paymentRuleId
          ? this.paymentRuleService.findOne(
              createWorkerInput.paymentRuleId,
              cu,
              scopes,
              manager, // Pasar el manager de la transacción
            )
          : Promise.resolve(undefined),
        createWorkerInput.officeId
          ? this.officeService.findOne(
              createWorkerInput.officeId,
              cu,
              scopes,
              manager, // Pasar el manager de la transacción
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
          manager, // Pasar el manager de la transacción
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
        //office,
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

      const worker = await super.baseCreate({
        data: workerData as Worker,
        uniqueFields: [],
        cu,
        scopes,
        manager, // Pasar el manager de la transacción
      });

      return worker;
    };

    try {
      // Si ya estamos dentro de una transacción (manager externo proporcionado)
      if (externalManager) {
        return await createWorkerTransaction(externalManager);
      }

      // Si no hay transacción externa, crear una nueva
      return await this.workerRepository.manager.transaction(
        async (transactionalEntityManager) => {
          return await createWorkerTransaction(transactionalEntityManager);
        },
      );
    } catch (error) {
      // Manejar errores específicos si es necesario
      if (error instanceof NotFoundError) {
        throw error;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`Failed to create worker: ${error.message}`);
    }
  }

  // CAMBIO: Método para verificar si hay datos para crear usuario
  private hasUserCreationData(
    input: CreateWorkerInput | UpdateWorkerInput,
  ): boolean {
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
          : [Role.AGENT],
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

  async findWorkersByScope(
    filters: {
      businessId?: number;
      officeId?: number;
      departmentId?: number;
      teamId?: number;
      workerIds?: number[];
    },
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    // Construir el objeto fltrs dinámicamente
    const fltrs = new Array<ListFilter>();

    if (filters.businessId) {
      fltrs.push({
        property: 'businessId',
        operator: ConditionalOperator.EQUAL,
        value: filters.businessId.toString(),
      });
    }

    if (filters.officeId) {
      fltrs.push({
        property: 'officeId',
        operator: ConditionalOperator.EQUAL,
        value: filters.officeId.toString(),
      });
    }

    if (filters.departmentId) {
      fltrs.push({
        property: 'departmentId',
        operator: ConditionalOperator.EQUAL,
        value: filters.departmentId.toString(),
      });
    }

    if (filters.teamId) {
      fltrs.push({
        property: 'teamId',
        operator: ConditionalOperator.EQUAL,
        value: filters.teamId.toString(),
      });
    }

    if (filters.workerIds && filters.workerIds.length > 0) {
      const workeIdFlts: ListFilter = {
        filters: [],
        property: '',
        operator: ConditionalOperator.EQUAL,
        value: '',
      };
      filters.workerIds.forEach((workerId) => {
        workeIdFlts.filters!.push({
          property: 'id',
          operator: ConditionalOperator.EQUAL,
          value: workerId.toString(),
          logicalOperator: LogicalOperator.OR,
        });
      });
      fltrs.push(workeIdFlts);
    }

    return this.find({ filters: fltrs }, cu, scopes, manager);
  }

  async update(
    id: number,
    updateWorkerInput: UpdateWorkerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    externalManager?: EntityManager,
  ): Promise<Worker> {
    // Verificar información del worker primero
    this.checkWorkerInformation(updateWorkerInput, {
      role: cu?.role ?? [],
    });

    // Función interna que contiene toda la lógica de actualización
    const updateWorkerTransaction = async (
      manager: EntityManager,
    ): Promise<Worker> => {
      // Obtener el worker existente
      const worker = await super.baseFindOne({
        id,
        cu,
        scopes,
        manager,
      });

      if (!worker) {
        throw new NotFoundError('Worker not found');
      }

      // Obtener entidades relacionadas
      const [user, paymentRule, office] = await Promise.all([
        updateWorkerInput.userId !== undefined
          ? updateWorkerInput.userId
            ? this.userService.findOne(
                updateWorkerInput.userId,
                undefined,
                cu,
                scopes,
                manager,
              )
            : Promise.resolve(null) // userId explícitamente null
          : Promise.resolve(undefined), // userId no proporcionado
        updateWorkerInput.paymentRuleId
          ? this.paymentRuleService.findOne(
              updateWorkerInput.paymentRuleId,
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(undefined),
        updateWorkerInput.officeId
          ? this.officeService.findOne(
              updateWorkerInput.officeId,
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(undefined),
      ]);

      // CAMBIO PRINCIPAL: Crear usuario si hay datos temporales y no hay usuario existente/asignado
      let createdUser: User | undefined;
      const shouldCreateUser =
        !user &&
        this.hasUserCreationData(updateWorkerInput) &&
        updateWorkerInput.userId === undefined; // Solo crear si no se está asignando un usuario explícitamente

      if (shouldCreateUser) {
        createdUser = await this.createUserFromWorkerData(
          {
            ...updateWorkerInput,
            workerType: updateWorkerInput.workerType ?? WorkerType.AGENT,
          } as CreateWorkerInput,
          cu,
          scopes,
          manager,
        );
      }

      // Validar que si se proporcionó userId, el usuario debe existir
      if (
        updateWorkerInput.userId !== undefined &&
        updateWorkerInput.userId !== null &&
        !user
      ) {
        throw new NotFoundError('User not found');
      }

      // Preparar datos de actualización
      const updateData: Partial<Worker> = {
        ...updateWorkerInput,
        user:
          user !== undefined && user !== null
            ? user
            : createdUser || worker.user,
        paymentRule:
          paymentRule !== undefined ? paymentRule : worker.paymentRule,
        office: office !== undefined ? office : worker.office,
      };

      // Manejar limpieza de campos temporales
      if (
        createdUser ||
        (updateWorkerInput.userId !== undefined &&
          updateWorkerInput.userId !== null)
      ) {
        // Si se creó un usuario o se asignó uno existente, limpiar campos temporales
        updateData.tempFirstName = undefined;
        updateData.tempLastName = undefined;
        updateData.tempEmail = undefined;
        updateData.tempPhone = undefined;
        updateData.tempRole = [];
      } else if (updateWorkerInput.userId === null) {
        // Si se desasocia explícitamente el usuario, mantener campos temporales si existen
        updateData.user = undefined;
        // No limpiar campos temporales en este caso
      }

      // Si se están proporcionando datos temporales y no hay usuario asignado/creado,
      // actualizar los campos temporales
      if (this.hasUserCreationData(updateWorkerInput) && !updateData.user) {
        updateData.tempFirstName = updateWorkerInput.tempFirstName;
        updateData.tempLastName = updateWorkerInput.tempLastName;
        updateData.tempEmail = updateWorkerInput.tempEmail;
        updateData.tempPhone = updateWorkerInput.tempPhone;
        updateData.tempRole = updateWorkerInput.tempRole || [];
      }

      return super.baseUpdate({
        id,
        data: updateData as Worker,
        cu,
        scopes,
        manager,
      });
    };

    try {
      // Si ya estamos dentro de una transacción (manager externo proporcionado)
      if (externalManager) {
        return await updateWorkerTransaction(externalManager);
      }

      // Si no hay transacción externa, crear una nueva
      return await this.workerRepository.manager.transaction(
        async (transactionalEntityManager) => {
          return await updateWorkerTransaction(transactionalEntityManager);
        },
      );
    } catch (error) {
      // Manejar errores específicos
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof BadRequestError) {
        throw error;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`Failed to update worker: ${error.message}`);
    }
  }

  // async update(
  //   id: number,
  //   updateWorkerInput: UpdateWorkerInput,
  //   cu?: JWTPayload,
  //   scopes?: ScopedAccessEnum[],
  //   manager?: EntityManager,
  // ): Promise<Worker> {
  //   const worker = await super.baseFindOne({ id, cu, scopes, manager });
  //   if (!worker) {
  //     throw new NotFoundError();
  //   }

  //   // CAMBIO: Manejar actualización de usuario
  //   if (updateWorkerInput.userId !== undefined) {
  //     if (updateWorkerInput.userId === null) {
  //       // Permitir desasociar usuario
  //       worker.user = undefined;
  //     } else {
  //       const user = await this.userService.findOne(
  //         updateWorkerInput.userId,
  //         undefined,
  //         cu,
  //         scopes,
  //         manager,
  //       );
  //       if (!user) {
  //         throw new NotFoundError('User not found');
  //       }
  //       worker.user = user;

  //       // Limpiar campos temporales si se asocia un usuario
  //       worker.tempFirstName = undefined;
  //       worker.tempLastName = undefined;
  //       worker.tempEmail = undefined;
  //       worker.tempPhone = undefined;
  //       worker.tempRole = [];
  //     }
  //   }

  //   if (updateWorkerInput.paymentRuleId) {
  //     const paymentRule = await this.paymentRuleService.findOne(
  //       updateWorkerInput.paymentRuleId,
  //       cu,
  //       scopes,
  //       manager,
  //     );
  //     worker.paymentRule = paymentRule;
  //   }

  //   if (updateWorkerInput.officeId) {
  //     const office = await this.officeService.findOne(
  //       updateWorkerInput.officeId,
  //       cu,
  //       scopes,
  //       manager,
  //     );
  //     worker.office = office;
  //   }

  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   const { userId, paymentRuleId, officeId, ...rest } = updateWorkerInput;
  //   return super.baseUpdate({
  //     id,
  //     data: { ...worker, ...rest },
  //     cu,
  //     scopes,
  //     manager,
  //   });
  // }

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

  private checkWorkerInformation(
    workerInput: CreateWorkerInput | UpdateWorkerInput,
    currentUser: { role: Role[] },
  ): void {
    // Acceder al rol desde la clase base
    const workerRole = workerInput.tempRole?.at(0);

    if (workerRole === Role.SUPER) {
      throw new BadRequestError('A worker cannot have a SUPER role.');
    }
    if (workerRole === Role.PRINCIPAL) {
      if (
        workerInput.officeId ||
        workerInput.departmentId ||
        workerInput.teamId
      ) {
        throw new BadRequestError(
          'PRINCIPAL cannot have office, department or team',
        );
      }
    }
    if (workerRole === Role.ADMIN) {
      if (!workerInput.officeId) {
        throw new BadRequestError('The administrator has no office');
      }
      if (workerInput.departmentId || workerInput.teamId) {
        throw new BadRequestError(
          'The administrator cannot have a department or team',
        );
      }
    }
    if (workerRole === Role.MANAGER) {
      if (!workerInput.officeId || !workerInput.departmentId) {
        throw new BadRequestError('The manager has no office or department');
      }
      if (workerInput.teamId) {
        throw new BadRequestError('The manager cannot have a team');
      }
    }
    if (
      workerRole === Role.SUPERVISOR &&
      (!workerInput.officeId ||
        !workerInput.departmentId ||
        !workerInput.teamId)
    ) {
      throw new BadRequestError(
        'The supervisor has no office, department or team',
      );
    }
    if (
      workerRole === Role.AGENT &&
      (!workerInput.officeId ||
        !workerInput.departmentId ||
        !workerInput.teamId)
    ) {
      throw new BadRequestError('The agent has no office, department or team');
    }

    // Check that a role cannot create a higher one
    if (currentUser.role.some((r) => r === Role.ADMIN)) {
      if (workerRole === Role.PRINCIPAL || workerRole === Role.ADMIN) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
    if (currentUser.role.some((r) => r === Role.MANAGER)) {
      if (
        workerRole === Role.PRINCIPAL ||
        workerRole === Role.ADMIN ||
        workerRole === Role.MANAGER
      ) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
    if (currentUser.role.some((r) => r === Role.SUPERVISOR)) {
      if (
        workerRole === Role.PRINCIPAL ||
        workerRole === Role.ADMIN ||
        workerRole === Role.MANAGER ||
        workerRole === Role.SUPERVISOR
      ) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
    if (currentUser.role.some((r) => r === Role.AGENT)) {
      if (
        workerRole === Role.PRINCIPAL ||
        workerRole === Role.ADMIN ||
        workerRole === Role.MANAGER ||
        workerRole === Role.SUPERVISOR ||
        workerRole === Role.AGENT
      ) {
        throw new BadRequestError(
          'You cannot create a user with a role greater than or equal to yours',
        );
      }
    }
  }
}
