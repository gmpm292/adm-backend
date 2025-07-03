import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { CreateDepartmentInput } from '../dto/create-department.input';
import { UpdateDepartmentInput } from '../dto/update-department.input';
import { BaseService } from '../../../../core/services/base.service';
import { Department } from '../entities/co_department.entity';
import { Office } from '../../office/entities/co_office.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { TeamService } from '../../team/services/team.service';
import { UsersService } from '../../../users/services/users.service';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';

@Injectable()
export class DepartmentService extends BaseService<Department> {
  constructor(
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectEntityManager()
    private readonly manager: EntityManager,
    private userService: UsersService,
    private teamService: TeamService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(departmentRepository);
  }

  async create(
    dto: CreateDepartmentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ) {
    const { officeId, ...rest } = dto;

    // Get the office with its business
    const office = await (manager || this.manager).findOne(Office, {
      where: { id: officeId },
      relations: ['business'],
    });

    if (!office) {
      throw new NotFoundError('Office not found');
    }

    const department: Department = {
      office: { id: officeId } as Office,
      business: office.business, // Set the business from the office
      ...rest,
    };

    await this.validateUniqueDepartment(dto, cu, scopes, manager);
    return super.baseCreate({
      data: department,
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
      relationsToLoad: ['office', 'business'],
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
  ): Promise<Department> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        office: true,
        business: true,
        teams: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findOneByFilters(
    filters: FindOptionsWhere<Department>,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Department> {
    return super.baseFindOneByFilters({
      filters,
      relationsToLoad: {
        office: true,
        business: true,
        teams: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateDepartmentInput: UpdateDepartmentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Department> {
    const { officeId, ...rest } = updateDepartmentInput;

    const toUpdate: DeepPartial<Department> = {
      ...rest,
    };

    if (officeId) {
      // Get the office with its business if officeId is provided
      const office = await (manager || this.manager).findOne(Office, {
        where: { id: officeId },
        relations: ['business'],
      });

      if (!office) {
        throw new NotFoundError('Office not found');
      }

      toUpdate.office = { id: officeId };
      toUpdate.business = office.business; // Update the business from the new office
    }

    return super.baseUpdate({
      id,
      data: toUpdate,
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
  ): Promise<Department[]> {
    const departments = await super.baseFindByIds({
      ids,
      relationsToLoad: {
        users: true,
        teams: true,
      },
      cu,
      scopes,
      manager,
    });

    if (departments.length === 0) {
      throw new NotFoundError('No departments found');
    }

    await Promise.all([
      ...departments.flatMap((department) =>
        department.users?.length
          ? this.userService.remove(
              department.users.map((u) => u.id) as number[],
              undefined,
              cu as JWTPayload,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
      ...departments.flatMap((department) =>
        department.teams?.length
          ? this.teamService.remove(
              department.teams.map((t) => t.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    ]);

    return super.baseDeleteMany({
      ids: departments.map((d) => d.id) as number[],
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
    if (ids.length === 0) return 0;

    const departments = await super.baseFindByIds({
      ids,
      relationsToLoad: {
        users: true,
        teams: true,
      },
      cu,
      scopes,
      withDeleted: true,
      manager,
    });

    const deletedDepartments = departments.filter((d) => d.deletedAt);
    if (deletedDepartments.length === 0) return 0;

    await Promise.all([
      ...deletedDepartments.flatMap((department) =>
        department.users?.filter((u) => u.deletedAt)?.length
          ? this.userService.restore(
              department.users
                .filter((u) => u.deletedAt)
                .map((u) => u.id as number),
              cu as JWTPayload,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
      ...deletedDepartments.flatMap((department) =>
        department.teams?.filter((t) => t.deletedAt)?.length
          ? this.teamService.restore(
              department.teams
                .filter((t) => t.deletedAt)
                .map((t) => t.id) as Array<number>,
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    ]);

    return super.baseRestoreDeletedMany({
      ids: deletedDepartments.map((d) => d.id) as number[],
      cu,
      scopes,
      manager,
    });
  }

  async validateUniqueDepartment(
    createDepartmentInput: CreateDepartmentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    const dataInDB = await this.baseFind({
      options: {
        take: 0,
        filters: [
          {
            property: 'departmentType',
            operator: ConditionalOperator.EQUAL,
            value: createDepartmentInput.departmentType,
          },
          {
            property: 'office.id',
            operator: ConditionalOperator.EQUAL,
            value: createDepartmentInput.officeId.toString(),
          },
        ],
      },
      relationsToLoad: ['office'],
      cu,
      scopes,
      manager,
    });
    if (dataInDB.totalCount > 0) {
      throw new ConflictError(`The department already exists`);
    }
    return true;
  }
}
