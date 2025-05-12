import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreatePayrollPeriodInput } from '../dto/create-payroll-period.input';
import { UpdatePayrollPeriodInput } from '../dto/update-payroll-period.input';
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
import { PayrollPeriodService } from '../services/payroll-period.service';
import { PayrollPeriodFiltersValidator } from '../filters-validator/payroll-period-filters.validator';

@Resolver('PayrollPeriod')
export class PayrollPeriodResolver {
  constructor(private readonly payrollPeriodService: PayrollPeriodService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createPayrollPeriod')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createPayrollPeriodInput')
    createPayrollPeriodInput: CreatePayrollPeriodInput,
  ) {
    return this.payrollPeriodService.create(createPayrollPeriodInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('payrollPeriods')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: PayrollPeriodFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.payrollPeriodService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('payrollPeriod')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.payrollPeriodService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updatePayrollPeriod')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updatePayrollPeriodInput')
    updatePayrollPeriodInput: UpdatePayrollPeriodInput,
  ) {
    return this.payrollPeriodService.update(
      updatePayrollPeriodInput.id,
      updatePayrollPeriodInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('closePayrollPeriod')
  async close(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.payrollPeriodService.closePeriod(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removePayrollPeriods')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.payrollPeriodService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restorePayrollPeriods')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.payrollPeriodService.restore(ids, user);
  }
}
