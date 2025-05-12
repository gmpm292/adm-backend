import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateInventoryMovementInput } from '../dto/create-inventory-movement.input';
import { UpdateInventoryMovementInput } from '../dto/update-inventory-movement.input';
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
import { InventoryMovementService } from '../services/inventory-movement.service';
import { InventoryMovementFiltersValidator } from '../filters-validator/inventory-movement-filters.validator';

@Resolver('InventoryMovement')
export class InventoryMovementResolver {
  constructor(private readonly movementService: InventoryMovementService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createInventoryMovement')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createInventoryMovementInput')
    createInput: CreateInventoryMovementInput,
  ) {
    return this.movementService.create(createInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('inventoryMovements')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: InventoryMovementFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.movementService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('inventoryMovement')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.movementService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateInventoryMovement')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateInventoryMovementInput')
    updateInput: UpdateInventoryMovementInput,
  ) {
    return this.movementService.update(updateInput.id, updateInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeInventoryMovements')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.movementService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreInventoryMovements')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.movementService.restore(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('movementsByInventory')
  async findByInventory(
    @CurrentUser() user: JWTPayload,
    @Args('inventoryId') inventoryId: number,
  ) {
    return this.movementService.findByInventory(inventoryId, user);
  }
}
