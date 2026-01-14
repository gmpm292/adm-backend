import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { PaymentAccumulatorService } from '../services/payment-accumulator.service';
import { CreatePaymentAccumulatorInput } from '../dto/create-payment-accumulator.input';
import { UpdatePaymentAccumulatorInput } from '../dto/update-payment-accumulator.input';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { UseGuards } from '@nestjs/common';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { PaymentAccumulatorsFiltersValidator } from '../filters-validator/filters.validator';
import { Role } from '../../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';

@Resolver('PaymentAccumulator')
export class PaymentAccumulatorResolver {
  constructor(
    private readonly paymentAccumulatorService: PaymentAccumulatorService,
  ) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createPaymentAccumulator')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createPaymentAccumulatorInput')
    createPaymentAccumulatorInput: CreatePaymentAccumulatorInput,
  ) {
    return this.paymentAccumulatorService.create(
      createPaymentAccumulatorInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentAccumulators')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: PaymentAccumulatorsFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.paymentAccumulatorService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentAccumulator')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.paymentAccumulatorService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updatePaymentAccumulator')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updatePaymentAccumulatorInput')
    updatePaymentAccumulatorInput: UpdatePaymentAccumulatorInput,
  ) {
    return this.paymentAccumulatorService.update(
      updatePaymentAccumulatorInput.id,
      updatePaymentAccumulatorInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removePaymentAccumulators')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.paymentAccumulatorService.remove(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restorePaymentAccumulators')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.paymentAccumulatorService.restore(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentAccumulatorsByWorkerAndPeriod')
  async findByWorkerAndPeriod(
    @CurrentUser() user: JWTPayload,
    @Args('workerId') workerId: number,
    @Args('payrollPeriodId') payrollPeriodId: number,
  ) {
    return this.paymentAccumulatorService.findByWorkerAndPeriod(
      workerId,
      payrollPeriodId,
      user,
    );
  }
}
