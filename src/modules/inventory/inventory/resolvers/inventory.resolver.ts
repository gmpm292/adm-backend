import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateInventoryInput } from '../dto/create-inventory.input';
import { UpdateInventoryInput } from '../dto/update-inventory.input';
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
import { InventoryService } from '../services/inventory.service';
import { InventoryFiltersValidator } from '../filters-validator/inventory-filters.validator';

@Resolver('Inventory')
export class InventoryResolver {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createInventory')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createInventoryInput') createInventoryInput: CreateInventoryInput,
  ) {
    return this.inventoryService.create(createInventoryInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('inventories')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: InventoryFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.inventoryService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('inventory')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.inventoryService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateInventory')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateInventoryInput') updateInventoryInput: UpdateInventoryInput,
  ) {
    return this.inventoryService.update(
      updateInventoryInput.id,
      updateInventoryInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeInventories')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.inventoryService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreInventories')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.inventoryService.restore(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('inventoriesByProduct')
  async findByProduct(
    @CurrentUser() user: JWTPayload,
    @Args('productId') productId: number,
  ) {
    return this.inventoryService.findByProduct(productId, user);
  }

  // @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('adjustInventory')
  // async adjust(
  //   @CurrentUser() user: JWTPayload,
  //   @Args('id') id: number,
  //   @Args('adjustment') adjustment: number,
  //   @Args('reason') reason: string,
  // ) {
  //   return this.inventoryService.adjust(id, adjustment, reason, user);
  // }
}
