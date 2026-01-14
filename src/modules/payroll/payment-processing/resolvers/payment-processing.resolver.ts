import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Role } from '../../../../core/enums/role.enum';
import { ListOptions } from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';
import { PaymentProcessingService } from '../servicesss/payment-processing.service';
import { ProcessPaymentsInput } from '../dto/process-payments.input';
import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

@Resolver('PaymentProcessing')
export class PaymentProcessingResolver {
  constructor(
    private readonly paymentProcessingService: PaymentProcessingService,
  ) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentProcessingStatus')
  async getProcessingStatus(
    @CurrentUser() user: JWTPayload,
    @Args('payrollPeriodId') payrollPeriodId: number,
    @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
    scopes?: ScopedAccessEnum[],
  ): Promise<PaymentProcessingSummary> {
    return this.paymentProcessingService.getProcessingStatus(
      payrollPeriodId,
      user,
      scopes,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('processedPayments')
  async getProcessedPayments(
    @CurrentUser() user: JWTPayload,
    @Args('payrollPeriodId') payrollPeriodId: number,
    @Opts({ arg: 'options' }) options?: ListOptions,
    @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
    scopes?: ScopedAccessEnum[],
  ): Promise<PaymentProcessingSummary> {
    return this.paymentProcessingService.getProcessedPayments(
      payrollPeriodId,
      options,
      user,
      scopes,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('processPayments')
  async processPayments(
    @CurrentUser() user: JWTPayload,
    @Args('processPaymentsInput') input: ProcessPaymentsInput,
    @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
    scopes?: ScopedAccessEnum[],
  ): Promise<PaymentProcessingSummary> {
    return this.paymentProcessingService.processPayments(input, user, scopes);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('approvePayments')
  async approvePayments(
    @CurrentUser() user: JWTPayload,
    @Args('paymentIds', { type: () => [Number] }) paymentIds: number[],
    @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
    scopes?: ScopedAccessEnum[],
  ): Promise<number> {
    return this.paymentProcessingService.approvePayments(
      paymentIds,
      user,
      scopes,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('rejectPayments')
  async rejectPayments(
    @CurrentUser() user: JWTPayload,
    @Args('paymentIds', { type: () => [Number] }) paymentIds: number[],
    @Args('reason') reason: string,
    @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
    scopes?: ScopedAccessEnum[],
  ): Promise<number> {
    return this.paymentProcessingService.rejectPayments(
      paymentIds,
      reason,
      user,
      scopes,
    );
  }
}
