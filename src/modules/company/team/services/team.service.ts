import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { CreateTeamInput } from '../dto/create-team.input';
import { UpdateTeamInput } from '../dto/update-team.input';
import { BaseService } from '../../../../core/services/base.service';
import { Team } from '../entities/co_team.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { Department } from '../../department/entities/co_department.entity';
import { User } from '../../../users/entities/user.entity';
import {
  assertNotInUse,
  assertUniqueName,
  cleanName,
  cleanText,
  plural,
} from '../../helpers/company-structure.helper';

const TEAM_RELATIONS = { department: true, office: true, business: true };

@Injectable()
export class TeamService extends BaseService<Team> {
  constructor(
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(teamRepository);
  }

  private managerOf(manager?: EntityManager): EntityManager {
    return manager ?? this.teamRepository.manager;
  }

  /** El departamento con su oficina y su empresa: el equipo hereda las tres. */
  private async findDepartment(
    departmentId: number,
    manager?: EntityManager,
  ): Promise<Department> {
    const department = await this.managerOf(manager).findOne(Department, {
      where: { id: departmentId },
      relations: { office: true, business: true },
    });
    if (!department) throw new NotFoundError('Departamento no encontrado');
    return department;
  }

  async create(
    createTeamInput: CreateTeamInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Team> {
    const name = cleanName(createTeamInput.name);
    const department = await this.findDepartment(
      createTeamInput.departmentId,
      manager,
    );

    await assertUniqueName(
      this.managerOf(manager),
      Team,
      name,
      { department: { id: department.id } },
      `"${department.name}" ya tiene un equipo llamado "${name}"`,
    );

    const team = {
      name,
      description: cleanText(createTeamInput.description),
      teamType: createTeamInput.teamType,
      department: { id: department.id },
      office: department.office ? { id: department.office.id } : undefined,
      business: department.business
        ? { id: department.business.id }
        : undefined,
    } as Team;

    const created = await super.baseCreate({
      data: team,
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
      relationsToLoad: ['department', 'office', 'business'],
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
  ): Promise<Team> {
    return super.baseFindOne({
      id,
      relationsToLoad: TEAM_RELATIONS,
      cu,
      scopes,
      manager,
    });
  }

  async findOneByFilters(
    filters: FindOptionsWhere<Team>,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Team> {
    return super.baseFindOneByFilters({
      filters,
      relationsToLoad: TEAM_RELATIONS,
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateTeamInput: UpdateTeamInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Team> {
    const team = await this.findOne(id, cu, scopes, manager);
    const data: Partial<Team> = {};

    const { departmentId } = updateTeamInput;
    if (departmentId && departmentId !== team.department?.id) {
      // Sus usuarios seguirían apuntando al departamento anterior.
      throw new BadRequestError(
        'Un equipo no puede cambiarse de departamento: crea otro en el departamento nuevo',
      );
    }

    if (updateTeamInput.name !== undefined) {
      data.name = cleanName(updateTeamInput.name);
      await assertUniqueName(
        this.managerOf(manager),
        Team,
        data.name,
        { department: { id: team.department?.id } },
        `El departamento ya tiene un equipo llamado "${data.name}"`,
        id,
      );
    }
    if (updateTeamInput.teamType) data.teamType = updateTeamInput.teamType;
    if (updateTeamInput.description !== undefined) {
      data.description = cleanText(updateTeamInput.description) as string;
    }

    if (Object.keys(data).length > 0) {
      await super.baseUpdate({ id, data, cu, scopes, manager });
    }
    return this.findOne(id, cu, scopes, manager);
  }

  /** Solo se elimina un equipo vacío: sus usuarios no se eliminan con él. */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Team[]> {
    const teams = await super.baseFindByIds({ ids, cu, scopes, manager });

    if (teams.length === 0) {
      throw new NotFoundError('Equipo no encontrado');
    }

    await assertNotInUse(this.managerOf(manager), teams, [
      {
        entity: User,
        where: (id) => ({ team: { id } }),
        label: plural('usuario', 'usuarios'),
      },
    ]);

    return super.baseDeleteMany({
      ids: teams.map((t) => t.id) as number[],
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

    const teams = await super.baseFindByIds({
      ids,
      relationsToLoad: { department: true },
      cu,
      scopes,
      withDeleted: true,
      manager,
    });

    const deletedTeams = teams.filter((t) => t.deletedAt);
    if (deletedTeams.length === 0) return 0;

    if (deletedTeams.some((t) => !t.department || t.department.deletedAt)) {
      throw new BadRequestError(
        'El departamento de este equipo está eliminado: restáuralo primero',
      );
    }

    return super.baseRestoreDeletedMany({
      ids: deletedTeams.map((t) => t.id) as number[],
      cu,
      scopes,
      manager,
    });
  }
}
