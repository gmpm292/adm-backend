import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { TaskRegistryService } from '../services/task-registry.service';
import { TaskSchedulerService } from '../services/task-scheduler.service';
import { CreateScheduledTaskInput } from '../dto/create-scheduled-task.input';
import { ScheduledTask } from '../entities/scheduled-task.entity';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { ScheduledTaskFiltersValidator } from '../filters-validator/filters.validator';
import { Opts } from '../../../core/graphql/remote-operations/decorators/opts.decorator';

@Resolver('ScheduledTask')
export class TaskSchedulerResolver {
  constructor(
    private readonly taskRegistry: TaskRegistryService,
    private readonly scheduler: TaskSchedulerService,
  ) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createScheduledTask')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createScheduledTaskInput')
    createScheduledTaskInput: CreateScheduledTaskInput,
  ): Promise<ScheduledTask> {
    const task = await this.taskRegistry.create(createScheduledTaskInput);
    this.scheduler.scheduleTask(task);
    return task;
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('scheduledTasks')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: ScheduledTaskFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.taskRegistry.find(options, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateScheduledTask')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: number,
    @Args('cronExpression') cronExpression: string,
    @Args('isActive') isActive: boolean,
  ): Promise<ScheduledTask> {
    const task = await this.taskRegistry.update(id, {
      id,
      cronExpression,
      isActive,
    });
    this.scheduler.updateTask(task);
    return task;
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeScheduledTask')
  async remove(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: number,
  ): Promise<boolean> {
    this.scheduler.removeTask(String(id));
    await this.taskRegistry.remove([id]);
    return true;
  }
}
