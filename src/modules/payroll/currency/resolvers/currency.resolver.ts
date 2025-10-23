import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateCurrencyInput } from '../dto/create-currency.input';
import { UpdateCurrencyInput } from '../dto/update-currency.input';
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
import { CurrencyService } from '../services/currency.service';
import { CurrencyFiltersValidator } from '../filters-validator/currency-filters.validator';

@Resolver('Currency')
export class CurrencyResolver {
  constructor(private readonly currencyService: CurrencyService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createCurrency')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createCurrencyInput') createCurrencyInput: CreateCurrencyInput,
  ) {
    return this.currencyService.create(createCurrencyInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('currencies')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: CurrencyFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.currencyService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('currencyById')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.currencyService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('currency')
  async findByCode(
    @CurrentUser() user: JWTPayload,
    @Args('code') code: string,
  ) {
    return this.currencyService.findByCode(code, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateCurrency')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateCurrencyInput') updateCurrencyInput: UpdateCurrencyInput,
  ) {
    return this.currencyService.update(
      updateCurrencyInput.id,
      updateCurrencyInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('deactivateCurrency')
  async deactivate(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.currencyService.updateStatus(id, false, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('activateCurrency')
  async activate(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.currencyService.updateStatus(id, true, user);
  }
}
