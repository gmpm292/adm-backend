// payment-processing/resolvers/payment-processing.resolver.ts
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Role } from '../../../../core/enums/role.enum';
import { ProcessPeriodPaymentsInput } from '../dto/process-payments.input';
import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { PaymentProcessingService } from '../services/payment-processing.service';
import { ProcessSalePaymentInput } from '../dto/process-sale-payment.input';
import { RollbackSalePaymentsInput } from '../dto/rollback-sale-payments.input';
import { BatchSaleProcessingResult } from '../types/batch-sale-processing-result.type';
import { PeriodSalesProcessingResult } from '../types/period-sales-processing-result.type';

@Resolver('PaymentProcessing')
export class PaymentProcessingResolver {
  constructor(
    private readonly paymentProcessingService: PaymentProcessingService,
  ) {}

  // ==================== (Comentadas por ahora) ====================

  // @Roles(Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Query('paymentProcessingStatus')
  // async getProcessingStatus(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('payrollPeriodId') payrollPeriodId: number,
  // ): Promise<PaymentProcessingSummary> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }

  // @Roles(Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Query('processedPayments')
  // async getProcessedPayments(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('payrollPeriodId') payrollPeriodId: number,
  //   @Opts({ arg: 'options' }) options?: ListOptions,
  // ): Promise<PaymentProcessingSummary> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }

  // ==================== MUTATIONS (Implementadas) ====================

  @Roles(Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('processPeriodPayments')
  async processPeriodPayments(
    @CurrentUser() user: JWTPayload,
    @Args('processPeriodPaymentsInput') input: ProcessPeriodPaymentsInput,
  ): Promise<PaymentProcessingSummary> {
    return this.paymentProcessingService.processPeriodPayments(input, user);
  }

  @Roles(Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('processSalePayment')
  async processSalePayment(
    @CurrentUser() user: JWTPayload,
    @Args('processSalePaymentInput') input: ProcessSalePaymentInput,
  ): Promise<{
    success: boolean;
    paymentsCreated: number;
    totalAmount: number;
    saleId: number;
    details: any[];
  }> {
    return this.paymentProcessingService.processSalePayment(input, user);
  }

  @Roles(Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('processBatchSalePayments')
  async processBatchSalePayments(
    @CurrentUser() user: JWTPayload,
    @Args('saleIds') saleIds: number[],
  ): Promise<BatchSaleProcessingResult> {
    return this.paymentProcessingService.processBatchSalePayments(
      saleIds,
      user,
    );
  }

  @Roles(Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('processPeriodSales')
  async processPeriodSales(
    @CurrentUser() user: JWTPayload,
    @Args('payrollPeriodId') payrollPeriodId: number,
  ): Promise<PeriodSalesProcessingResult> {
    return this.paymentProcessingService.processPeriodSales(
      payrollPeriodId,
      user,
    );
  }

  @Roles(Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('rollbackSalePayments')
  async rollbackSalePayments(
    @CurrentUser() user: JWTPayload,
    @Args('rollbackSalePaymentsInput') input: RollbackSalePaymentsInput,
  ): Promise<{
    success: boolean;
    originalPaymentsReversed: number;
    compensationPaymentsCreated: number;
    nextPeriodId?: number;
    details: any[];
  }> {
    return this.paymentProcessingService.rollbackSalePayments(input, user);
  }

  // ==================== MUTATIONS (Comentadas por ahora) ====================

  // @Roles(Role.PRINCIPAL, Role.ADMIN)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('approvePayments')
  // async approvePayments(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('paymentIds', { type: () => [Number] }) paymentIds: number[],
  // ): Promise<number> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }

  // @Roles(Role.PRINCIPAL, Role.ADMIN)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('rejectPayments')
  // async rejectPayments(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('paymentIds', { type: () => [Number] }) paymentIds: number[],
  //   @Args('reason') reason: string,
  // ): Promise<number> {
  //   // TODO: Implementar en PaymentProcessingService
  //   throw new Error('Not implemented yet');
  // }
}
