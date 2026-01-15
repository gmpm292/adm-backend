// payment-processing/resolvers/payment-processing.resolver.ts
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Role } from '../../../../core/enums/role.enum';
import { ProcessPaymentsInput } from '../dto/process-payments.input';
import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { PaymentProcessingService } from '../services/payment-processing.service';
import { ProcessSalePaymentInput } from '../dto/process-sale-payment.input';
//import { RollbackSalePaymentsInput } from '../dto/rollback-sale-payments.input';

@Resolver('PaymentProcessing')
export class PaymentProcessingResolver {
  constructor(
    private readonly paymentProcessingService: PaymentProcessingService,
  ) {}

  // ==================== QUERIES (Comentadas por ahora) ====================

  // @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Query('paymentProcessingStatus')
  // async getProcessingStatus(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('payrollPeriodId') payrollPeriodId: number,
  //   @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
  //   scopes?: ScopedAccessEnum[],
  // ): Promise<PaymentProcessingSummary> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }

  // @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Query('processedPayments')
  // async getProcessedPayments(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('payrollPeriodId') payrollPeriodId: number,
  //   @Opts({ arg: 'options' }) options?: ListOptions,
  //   @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
  //   scopes?: ScopedAccessEnum[],
  // ): Promise<PaymentProcessingSummary> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }

  // ==================== MUTATIONS (Implementadas) ====================

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
  @Mutation('processSalePayment')
  async processSalePayment(
    @CurrentUser() user: JWTPayload,
    @Args('processSalePaymentInput') input: ProcessSalePaymentInput,
    @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
    scopes?: ScopedAccessEnum[],
  ): Promise<{
    success: boolean;
    paymentsCreated: number;
    totalAmount: number;
    saleId: number;
    details: any[];
  }> {
    return this.paymentProcessingService.processSalePayment(
      input,
      user,
      scopes,
    );
  }

  // @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('rollbackSalePayments')
  // async rollbackSalePayments(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('rollbackSalePaymentsInput') input: RollbackSalePaymentsInput,
  //   @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
  //   scopes?: ScopedAccessEnum[],
  // ): Promise<{
  //   success: boolean;
  //   originalPaymentsReversed: number;
  //   compensationPaymentsCreated: number;
  //   nextPeriodId?: number;
  //   details: any[];
  // }> {
  //   return this.paymentProcessingService.rollbackSalePayments(
  //     input,
  //     user,
  //     scopes,
  //   );
  // }

  // ==================== MUTATIONS (Comentadas por ahora) ====================

  // @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('approvePayments')
  // async approvePayments(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('paymentIds', { type: () => [Number] }) paymentIds: number[],
  //   @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
  //   scopes?: ScopedAccessEnum[],
  // ): Promise<number> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }

  // @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('rejectPayments')
  // async rejectPayments(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('paymentIds', { type: () => [Number] }) paymentIds: number[],
  //   @Args('reason') reason: string,
  //   @Args('scopes', { type: () => [ScopedAccessEnum], nullable: true })
  //   scopes?: ScopedAccessEnum[],
  // ): Promise<number> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }
}
