import { UseGuards } from '@nestjs/common';
import {
  Args,
  Mutation,
  Query,
  Resolver,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateMaterialCostInput } from '../dto/create-material-cost.input';
import { UpdateMaterialCostInput } from '../dto/update-material-cost.input';
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
import { MaterialCostService } from '../services/material-cost.service';
import { MaterialCostFiltersValidator } from '../filters-validator/material-cost.filters.validator';

import { Currency } from '../../currency/entities/currency.entity';
import { MaterialCost } from '../entities/material-cost.entity';
import { UnitOfMeasure } from '../../../inventory/unit-of-measure/entities/unit-of-measure.entity';
import { Product } from '../../../inventory/product/entities/product.entity';

@Resolver('MaterialCost')
export class MaterialCostResolver {
  constructor(private readonly materialCostService: MaterialCostService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createMaterialCost')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createMaterialCostInput')
    createMaterialCostInput: CreateMaterialCostInput,
  ) {
    return this.materialCostService.create(createMaterialCostInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('materialCosts')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: MaterialCostFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.materialCostService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('materialCost')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.materialCostService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateMaterialCost')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateMaterialCostInput')
    updateMaterialCostInput: UpdateMaterialCostInput,
  ) {
    return this.materialCostService.update(
      updateMaterialCostInput.id,
      updateMaterialCostInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeMaterialCosts')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.materialCostService.remove(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreMaterialCosts')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.materialCostService.restore(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('toggleMaterialCostActive')
  async toggleActive(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.materialCostService.toggleActive(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('materialCostsByUnitOfMeasure')
  async findByUnitOfMeasure(
    @CurrentUser() user: JWTPayload,
    @Args('unitOfMeasureId') unitOfMeasureId: number,
    @Opts({ arg: 'options', dto: MaterialCostFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.materialCostService.findByUnitOfMeasure(
      unitOfMeasureId,
      options,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('materialCostsByCurrency')
  async findByCurrency(
    @CurrentUser() user: JWTPayload,
    @Args('currencyId') currencyId: number,
    @Opts({ arg: 'options', dto: MaterialCostFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.materialCostService.findByCurrency(currencyId, options, user);
  }

  // ResolveField for unitOfMeasure
  @ResolveField('unitOfMeasure')
  getUnitOfMeasure(@Parent() materialCost: MaterialCost): UnitOfMeasure {
    return materialCost.unitOfMeasure;
  }

  // ResolveField for currency
  @ResolveField('currency')
  getCurrency(@Parent() materialCost: MaterialCost): Currency {
    return materialCost.currency;
  }

  // ResolveField for products
  @ResolveField('products')
  getProducts(@Parent() materialCost: MaterialCost): Product[] {
    return materialCost.products || [];
  }
}
