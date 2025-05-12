import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateWorkerInput } from '../dto/create-worker.input';
import { UpdateWorkerInput } from '../dto/update-worker.input';
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
import { WorkerService } from '../services/worker.service';
import { WorkerFiltersValidator } from '../filters-validator/worker-filters.validator';

@Resolver('Worker')
export class WorkerResolver {
  constructor(private readonly workerService: WorkerService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createWorker')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createWorkerInput') createWorkerInput: CreateWorkerInput,
  ) {
    return this.workerService.create(createWorkerInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workers')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: WorkerFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.workerService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('worker')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.workerService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workersByOffice')
  async findByOffice(
    @CurrentUser() user: JWTPayload,
    @Args('officeId') officeId: number,
  ) {
    return this.workerService.findByOffice(officeId, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateWorker')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateWorkerInput') updateWorkerInput: UpdateWorkerInput,
  ) {
    return this.workerService.update(
      updateWorkerInput.id,
      updateWorkerInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeWorkers')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.workerService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreWorkers')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.workerService.restore(ids, user);
  }
}
