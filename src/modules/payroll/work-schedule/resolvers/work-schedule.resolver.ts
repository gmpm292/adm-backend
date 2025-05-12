import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateWorkScheduleInput } from '../dto/create-work-schedule.input';
import { UpdateWorkScheduleInput } from '../dto/update-work-schedule.input';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Role } from '../../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';
import { WorkScheduleService } from '../services/work-schedule.service';
import { WorkScheduleFiltersValidator } from '../filters-validator/work-schedule-filters.validator';

@Resolver('WorkSchedule')
export class WorkScheduleResolver {
  constructor(private readonly workScheduleService: WorkScheduleService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createWorkSchedule')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createWorkScheduleInput') createInput: CreateWorkScheduleInput,
  ) {
    return this.workScheduleService.create(createInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workSchedules')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: WorkScheduleFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.workScheduleService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workSchedule')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.workScheduleService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workSchedulesByOffice')
  async findByOffice(
    @CurrentUser() user: JWTPayload,
    @Args('officeId') officeId: number,
  ) {
    return this.workScheduleService.findByOffice(officeId, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateWorkSchedule')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateWorkScheduleInput') updateInput: UpdateWorkScheduleInput,
  ) {
    return this.workScheduleService.update(updateInput.id, updateInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeWorkSchedules')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.workScheduleService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreWorkSchedules')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.workScheduleService.restore(ids, user);
  }
}
