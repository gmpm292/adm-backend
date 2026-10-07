import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Not, Repository } from 'typeorm';
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
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { PaymentRuleService } from '../../payment-rule/services/payment-rule.service';
import { OfficeService } from '../../../company/office/services/office.service';
import { UsersService } from '../../../users/services/users.service';
import { User } from '../../../users/entities/user.entity';
import { Role } from '../../../../core/enums/role.enum';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { Business } from '../../../company/business/entities/co_business.entity';
import { Department } from '../../../company/department/entities/co_department.entity';
import { Team } from '../../../company/team/entities/co_team.entity';

/**
 * Trabajadores: quien vende, reparte o cobra nómina. Sus datos (nombre,
 * contacto) son suyos; la cuenta de usuario es opcional y se vincula, no se
 * crea desde aquí (las cuentas las crea un SUPER en Usuarios).
 */
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
    if (!manager) {
      return this.workerRepository.manager.transaction((txManager) =>
        this.create(createWorkerInput, cu, scopes, txManager),
      );
    }

    const {
      userId,
      paymentRuleId,
      businessId,
      officeId,
      departmentId,
      teamId,
      ...rest
    } = createWorkerInput;
    const personal = this.cleanPersonalData(rest);
    const placement = await this.placementOf(
      { businessId, officeId, departmentId, teamId },
      cu,
      scopes,
      manager,
    );
    if (!placement.business?.id) {
      throw new BadRequestError('Indica la empresa del trabajador');
    }

    const user = userId
      ? await this.linkableUser(userId, placement.business.id, undefined, cu)
      : undefined;
    if (!user && !personal.tempFirstName) {
      throw new BadRequestError(
        'Escribe el nombre del trabajador o vincúlalo a una cuenta',
      );
    }

    const paymentRule = paymentRuleId
      ? await this.paymentRuleService.findOne(
          paymentRuleId,
          cu,
          scopes,
          manager,
        )
      : undefined;

    return super.baseCreate({
      data: {
        ...personal,
        workerType: rest.workerType,
        otherType: rest.otherType?.trim() || undefined,
        baseSalary: rest.baseSalary ?? 0,
        customPaymentSettings: rest.customPaymentSettings,
        ...placement,
        user,
        paymentRule,
      } as Worker,
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
        'user',
        'paymentRule',
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
  ): Promise<Worker> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        user: true,
        paymentRule: true,
        business: true,
        office: true,
        department: true,
        team: true,
        createdBy: true,
        updatedBy: true,
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
    const fltrs = new Array<ListFilter>();
    const byId = (property: string, value?: number) => {
      if (value) {
        fltrs.push({
          property,
          operator: ConditionalOperator.EQUAL,
          value: value.toString(),
        });
      }
    };
    byId('businessId', filters.businessId);
    byId('officeId', filters.officeId);
    byId('departmentId', filters.departmentId);
    byId('teamId', filters.teamId);

    if (filters.workerIds && filters.workerIds.length > 0) {
      fltrs.push({
        property: '',
        operator: ConditionalOperator.EQUAL,
        value: '',
        filters: filters.workerIds.map((workerId) => ({
          property: 'id',
          operator: ConditionalOperator.EQUAL,
          value: workerId.toString(),
          logicalOperator: LogicalOperator.OR,
        })),
      });
    }

    return this.find({ filters: fltrs, take: 0 }, cu, scopes, manager).then(
      async (summary) =>
        // `take: 0` solo cuenta; aquí hacen falta todos
        summary.totalCount
          ? this.find(
              { filters: fltrs, skip: 0, take: summary.totalCount },
              cu,
              scopes,
              manager,
            )
          : summary,
    );
  }

  async update(
    id: number,
    updateWorkerInput: UpdateWorkerInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Worker> {
    if (!manager) {
      return this.workerRepository.manager.transaction((txManager) =>
        this.update(id, updateWorkerInput, cu, scopes, txManager),
      );
    }

    const worker = await this.findOne(id, cu, scopes, manager);
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      id: _id,
      userId,
      paymentRuleId,
      businessId,
      officeId,
      departmentId,
      teamId,
      ...rest
    } = updateWorkerInput;
    const data: Partial<Worker> = this.cleanPersonalData(rest);
    if (rest.workerType !== undefined) data.workerType = rest.workerType;
    if (rest.otherType !== undefined) {
      data.otherType = rest.otherType?.trim() || (null as unknown as string);
    }
    if (rest.baseSalary !== undefined) data.baseSalary = rest.baseSalary ?? 0;
    if (rest.customPaymentSettings !== undefined) {
      data.customPaymentSettings = rest.customPaymentSettings;
    }

    // El lugar se cambia entero: lo que no llega queda vacío
    if (
      [businessId, officeId, departmentId, teamId].some((v) => v !== undefined)
    ) {
      Object.assign(
        data,
        await this.placementOf(
          {
            businessId: businessId ?? worker.business?.id,
            officeId,
            departmentId,
            teamId,
          },
          cu,
          scopes,
          manager,
        ),
      );
    }

    // `null` desvincula la cuenta; sin el campo se queda la que tenía
    if (userId === null) {
      data.user = null as unknown as User;
    } else if (userId !== undefined) {
      data.user = await this.linkableUser(
        userId,
        (data.business ?? worker.business)?.id,
        id,
        cu,
      );
    }

    if (paymentRuleId === null) {
      data.paymentRule = null as unknown as Worker['paymentRule'];
    } else if (paymentRuleId !== undefined) {
      data.paymentRule = await this.paymentRuleService.findOne(
        paymentRuleId,
        cu,
        scopes,
        manager,
      );
    }

    const linked = data.user !== undefined ? data.user : worker.user;
    const firstName =
      data.tempFirstName !== undefined
        ? data.tempFirstName
        : worker.tempFirstName;
    if (!linked && !firstName) {
      throw new BadRequestError(
        'Escribe el nombre del trabajador o vincúlalo a una cuenta',
      );
    }

    return super.baseUpdate({
      id,
      data,
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

  /** Nombre y contacto sin espacios sobrantes; `null` vacía un dato */
  private cleanPersonalData(
    input: Partial<
      Pick<
        CreateWorkerInput,
        'tempFirstName' | 'tempLastName' | 'tempEmail' | 'tempPhone'
      >
    >,
  ): Partial<Worker> {
    const data: Partial<Worker> = {};
    for (const key of [
      'tempFirstName',
      'tempLastName',
      'tempEmail',
      'tempPhone',
    ] as const) {
      const value = input[key];
      if (value === undefined) continue;
      const clean = typeof value === 'string' ? value.trim() : '';
      data[key] = (clean || null) as string;
    }
    if (data.tempPhone) data.tempPhone = data.tempPhone.replace(/[\s-]/g, '');
    return data;
  }

  /**
   * Empresa, oficina, departamento y equipo coherentes entre sí: la oficina
   * manda sobre la empresa y debe pertenecer a ella.
   */
  private async placementOf(
    ids: {
      businessId?: number | null;
      officeId?: number | null;
      departmentId?: number | null;
      teamId?: number | null;
    },
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Pick<Worker, 'business' | 'office' | 'department' | 'team'>> {
    const office = ids.officeId
      ? await this.officeService.findOne(ids.officeId, cu, scopes, manager)
      : undefined;
    const businessId = office?.business?.id ?? ids.businessId ?? cu?.businessId;
    if (office && ids.businessId && office.business?.id !== ids.businessId) {
      throw new BadRequestError('La oficina no pertenece a esa empresa');
    }
    return {
      business: businessId ? ({ id: businessId } as Business) : undefined,
      office: office ?? (null as unknown as Worker['office']),
      department: ids.departmentId
        ? ({ id: ids.departmentId } as Department)
        : (null as unknown as Department),
      team: ids.teamId
        ? ({ id: ids.teamId } as Team)
        : (null as unknown as Team),
    };
  }

  /**
   * Cuenta que se puede vincular: de la misma empresa (salvo para SUPER) y
   * sin otro trabajador.
   */
  private async linkableUser(
    userId: number,
    businessId: number | undefined,
    workerId: number | undefined,
    cu?: JWTPayload,
  ): Promise<User> {
    const user = await this.userService.findOne(userId);
    const isSuper = cu?.role?.includes(Role.SUPER);
    if (!isSuper && businessId && user.business?.id !== businessId) {
      throw new BadRequestError('Esa cuenta es de otra empresa');
    }
    const other = await this.workerRepository.findOne({
      where: {
        user: { id: userId },
        ...(workerId && { id: Not(workerId) }),
      },
      withDeleted: true,
    });
    if (other) {
      throw new ConflictError(
        other.deletedAt
          ? 'Esa cuenta pertenece a un trabajador eliminado: restáuralo desde el listado'
          : 'Esa cuenta ya está vinculada a otro trabajador',
      );
    }
    return user;
  }
}
