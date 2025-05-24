import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TeamService } from '../services/team.service';
import { CreateTeamInput } from '../dto/create-team.input';
import { UpdateTeamInput } from '../dto/update-team.input';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { UseGuards } from '@nestjs/common';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { TeamsFiltersValidator } from '../filters-validator/filters.validator';
import { Role } from '../../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';

@Resolver('Team')
export class TeamResolver {
  constructor(private readonly teamService: TeamService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createTeam')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createTeamInput') createTeamInput: CreateTeamInput,
  ) {
    return this.teamService.create(createTeamInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('teams')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: TeamsFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.teamService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('team')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.teamService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateTeam')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateTeamInput') updateTeamInput: UpdateTeamInput,
  ) {
    return this.teamService.update(updateTeamInput.id, updateTeamInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeTeams')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.teamService.remove(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreTeams')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.teamService.restore(ids, user);
  }
}
