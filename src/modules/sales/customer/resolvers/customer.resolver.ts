import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateCustomerInput } from '../dto/create-customer.input';
import { UpdateCustomerInput } from '../dto/update-customer.input';
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
import { CustomerService } from '../services/customer.service';
import { CustomerFiltersValidator } from '../filters-validator/customer-filters.validator';

@Resolver('Customer')
export class CustomerResolver {
  constructor(private readonly customerService: CustomerService) {}

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createCustomer')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createCustomerInput') createCustomerInput: CreateCustomerInput,
  ) {
    return this.customerService.create(createCustomerInput, user);
  }

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('customers')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: CustomerFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.customerService.find(options, user);
  }

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('customer')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.customerService.findOne(id, user);
  }

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateCustomer')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateCustomerInput') updateCustomerInput: UpdateCustomerInput,
  ) {
    return this.customerService.update(
      updateCustomerInput.id,
      updateCustomerInput,
      user,
    );
  }

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeCustomers')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.customerService.remove(ids, user);
  }

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreCustomers')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.customerService.restore(ids, user);
  }
}
