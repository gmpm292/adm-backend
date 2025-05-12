import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreatePaymentRuleInput } from '../dto/create-payment-rule.input';
import { UpdatePaymentRuleInput } from '../dto/update-payment-rule.input';
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
import { PaymentRuleService } from '../services/payment-rule.service';

@Resolver('PaymentRule')
export class PaymentRuleResolver {
  constructor(private readonly paymentRuleService: PaymentRuleService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createPaymentRule')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createPaymentRuleInput')
    createPaymentRuleInput: CreatePaymentRuleInput,
  ) {
    return this.paymentRuleService.create(createPaymentRuleInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentRules')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts() options?: ListOptions,
  ): Promise<ListSummary> {
    return this.paymentRuleService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('paymentRule')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.paymentRuleService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updatePaymentRule')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updatePaymentRuleInput')
    updatePaymentRuleInput: UpdatePaymentRuleInput,
  ) {
    return this.paymentRuleService.update(
      updatePaymentRuleInput.id,
      updatePaymentRuleInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removePaymentRules')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.paymentRuleService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restorePaymentRules')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.paymentRuleService.restore(ids, user);
  }
}
