/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { CreateTeamInput } from '../dto/create-team.input';
import { UpdateTeamInput } from '../dto/update-team.input';
import { BaseService } from '../../../../core/services/base.service';
import { Team } from '../entities/co_team.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { UsersService } from '../../../users/services/users.service';
import { DepartmentService } from '../../department/services/department.service';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';

@Injectable()
export class TeamService extends BaseService<Team> {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @Inject(forwardRef(() => DepartmentService))
    private departmentService: DepartmentService,
    private userService: UsersService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(teamRepository);
  }

  async create(
    createTeamInput: CreateTeamInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Team> {
    const { departmentId, teamType } = createTeamInput;
    const team = { department: null, teamType: null } as unknown as Team;

    team.department = departmentId
      ? await this.departmentService.findOne(departmentId, cu, scopes, manager)
      : (null as any);
    team.teamType = teamType;

    await this.validateUniqueTeam(createTeamInput, cu, scopes, manager);
    return super.baseCreate({
      data: team,
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
      relationsToLoad: ['department', 'department.office'],
      cu,
      scopes,
      manager,
    });
  }

  async findOne(
    filters: FindOptionsWhere<Team>,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Team> {
    return super.baseFindOneByFilters({
      filters,
      relationsToLoad: {
        department: { office: true },
        teamType: true as any,
      },
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
    const { departmentId, teamType, ...rest } = updateTeamInput;
    const team = await super.baseFindOne({ id, cu, scopes, manager });
    if (!team) {
      throw new NotFoundError();
    }

    team.department = departmentId
      ? await this.departmentService.findOne(departmentId, cu, scopes, manager)
      : team.department;
    team.teamType = teamType || team.teamType;

    return super.baseUpdate({
      id,
      data: { ...team, ...rest },
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
  ): Promise<Team[]> {
    const teams = await super.baseFindByIds({
      ids,
      relationsToLoad: { users: true },
      cu,
      scopes,
      manager,
    });

    if (teams.length === 0) {
      throw new NotFoundError('No teams found');
    }

    await Promise.all(
      teams.map((team) =>
        team.users?.length
          ? this.userService.remove(
              team.users.map((u) => u.id) as number[],
              undefined,
              cu as JWTPayload,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

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
      relationsToLoad: { users: true },
      cu,
      scopes,
      withDeleted: true,
      manager,
    });

    const deletedTeams = teams.filter((t) => t.deletedAt);
    if (deletedTeams.length === 0) return 0;

    await Promise.all(
      deletedTeams.map((team) =>
        team.users?.filter((u) => u.deletedAt)?.length
          ? this.userService.restore(
              team.users.filter((u) => u.deletedAt).map((u) => u.id),
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseRestoreDeletedMany({
      ids: deletedTeams.map((t) => t.id) as number[],
      cu,
      scopes,
      manager,
    });
  }

  async validateUniqueTeam(
    createTeamInput: CreateTeamInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    const dataInDB = await this.baseFind({
      options: {
        take: 0,
        filters: [
          {
            property: 'teamType',
            operator: ConditionalOperator.EQUAL,
            value: createTeamInput.teamType,
          },
          {
            property: 'department.id',
            operator: ConditionalOperator.EQUAL,
            value: createTeamInput.departmentId.toString(),
          },
        ],
      },
      relationsToLoad: ['department'],
      cu,
      scopes,
      manager,
    });
    if (dataInDB.totalCount > 0) {
      throw new ConflictError(`The Team already exists`);
    }

    return true;
  }
}
