import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { CreateDepartmentInput } from '../dto/create-department.input';
import { UpdateDepartmentInput } from '../dto/update-department.input';
import { BaseService } from '../../../../core/services/base.service';
import { Department } from '../entities/co_department.entity';
import { Office } from '../../office/entities/co_office.entity';
import { Team } from '../../team/entities/co_team.entity';
import { User } from '../../../users/entities/user.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import {
  assertNotInUse,
  assertUniqueName,
  cleanName,
  cleanText,
  plural,
} from '../../helpers/company-structure.helper';

@Injectable()
export class DepartmentService extends BaseService<Department> {
  constructor(
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(departmentRepository);
  }

  private managerOf(manager?: EntityManager): EntityManager {
    return manager ?? this.departmentRepository.manager;
  }

  /** La oficina con su empresa: el departamento hereda ambas. */
  private async findOffice(
    officeId: number,
    manager?: EntityManager,
  ): Promise<Office> {
    const office = await this.managerOf(manager).findOne(Office, {
      where: { id: officeId },
      relations: ['business'],
    });
    if (!office) throw new NotFoundError('Oficina no encontrada');
    return office;
  }

  async create(
    dto: CreateDepartmentInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Department> {
    const name = cleanName(dto.name);
    const office = await this.findOffice(dto.officeId, manager);

    await assertUniqueName(
      this.managerOf(manager),
      Department,
      name,
      { office: { id: office.id } },
      `"${office.name}" ya tiene un departamento llamado "${name}"`,
    );

    const department = {
      office: { id: office.id } as Office,
      business: office.business,
      departmentType: dto.departmentType,
      name,
      description: cleanText(dto.description),
      address: cleanText((dto as { address?: string }).address),
    } as Department;

    const created = await super.baseCreate({
      data: department,
      cu,
      scopes,
      manager,
    });
    return this.findOne(created.id as number, cu, scopes, manager);
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const sorts = options?.sorts?.length
      ? options.sorts
      : [{ property: 'name', direction: SortDirection.ASC }];

    return await super.baseFind({
      options: { ...(options ?? { skip: 0, take: 10 }), sorts },
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
    const department = await this.findOne(id, cu, scopes, manager);
    const data: Partial<Department> = {};

    const { officeId } = updateDepartmentInput;
    if (officeId && officeId !== department.office?.id) {
      // Sus equipos y usuarios seguirían apuntando a la oficina anterior.
      throw new BadRequestError(
        'Un departamento no puede cambiarse de oficina: crea otro en la oficina nueva',
      );
    }

    if (updateDepartmentInput.name !== undefined) {
      data.name = cleanName(updateDepartmentInput.name);
      await assertUniqueName(
        this.managerOf(manager),
        Department,
        data.name,
        { office: { id: department.office?.id } },
        `La oficina ya tiene un departamento llamado "${data.name}"`,
        id,
      );
    }
    if (updateDepartmentInput.departmentType) {
      data.departmentType = updateDepartmentInput.departmentType;
    }
    const texts = updateDepartmentInput as {
      description?: string | null;
      address?: string | null;
    };
    for (const field of ['description', 'address'] as const) {
      if (texts[field] !== undefined) {
        data[field] = cleanText(texts[field]) as string;
      }
    }

    if (Object.keys(data).length > 0) {
      await super.baseUpdate({ id, data, cu, scopes, manager });
    }
    return this.findOne(id, cu, scopes, manager);
  }

  /** Solo se elimina un departamento vacío: sin equipos ni usuarios. */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Department[]> {
    const departments = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
    });

    if (departments.length === 0) {
      throw new NotFoundError('Departamento no encontrado');
    }

    await assertNotInUse(this.managerOf(manager), departments, [
      {
        entity: Team,
        where: (id) => ({ department: { id } }),
        label: plural('equipo', 'equipos'),
      },
      {
        entity: User,
        where: (id) => ({ department: { id } }),
        label: plural('usuario', 'usuarios'),
      },
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
      relationsToLoad: { office: true },
      cu,
      scopes,
      withDeleted: true,
      manager,
    });

    const deletedDepartments = departments.filter((d) => d.deletedAt);
    if (deletedDepartments.length === 0) return 0;

    if (deletedDepartments.some((d) => !d.office || d.office.deletedAt)) {
      throw new BadRequestError(
        'La oficina de este departamento está eliminada: restáurala primero',
      );
    }

    return super.baseRestoreDeletedMany({
      ids: deletedDepartments.map((d) => d.id) as number[],
      cu,
      scopes,
      manager,
    });
  }
}
