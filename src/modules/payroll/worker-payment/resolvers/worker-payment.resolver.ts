import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateWorkerPaymentInput } from '../dto/create-worker-payment.input';
import { UpdateWorkerPaymentInput } from '../dto/update-worker-payment.input';
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
import { WorkerPaymentService } from '../services/worker-payment.service';
import { WorkerPaymentFiltersValidator } from '../filters-validator/worker-payment-filters.validator';

@Resolver('WorkerPayment')
export class WorkerPaymentResolver {
  constructor(private readonly workerPaymentService: WorkerPaymentService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createWorkerPayment')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createWorkerPaymentInput') createInput: CreateWorkerPaymentInput,
  ) {
    return this.workerPaymentService.create(createInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workerPayments')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: WorkerPaymentFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.workerPaymentService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workerPayment')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.workerPaymentService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentsByWorker')
  async findByWorker(
    @CurrentUser() user: JWTPayload,
    @Args('workerId') workerId: number,
  ) {
    return this.workerPaymentService.findByWorker(workerId, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentsByPeriod')
  async findByPeriod(
    @CurrentUser() user: JWTPayload,
    @Args('periodId') periodId: number,
  ) {
    return this.workerPaymentService.findByPeriod(periodId, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateWorkerPayment')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateWorkerPaymentInput') updateInput: UpdateWorkerPaymentInput,
  ) {
    return this.workerPaymentService.update(updateInput.id, updateInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeWorkerPayments')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.workerPaymentService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreWorkerPayments')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.workerPaymentService.restore(ids, user);
  }
}
