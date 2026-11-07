import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateInventoryMovementInput } from '../dto/create-inventory-movement.input';
import { TransferInventoryInput } from '../dto/transfer-inventory.input';
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
import { InventoryBatchService } from '../services/inventory-batch.service';
import {
  LoadInventoryInput,
  SendInventoryInput,
} from '../dto/inventory-batch.input';

@Resolver('InventoryMovement')
export class InventoryMovementResolver {
  constructor(
    private readonly movementService: InventoryMovementService,
    private readonly batchService: InventoryBatchService,
  ) {}

  // Hoja de inventario: quien carga o envía. ADMIN, solo con su oficina
  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('inventorySheet')
  async sheet(
    @CurrentUser() user: JWTPayload,
    @Args('officeId') officeId: number,
    @Args('toOfficeId') toOfficeId?: number,
  ) {
    return this.batchService.sheet(officeId, toOfficeId ?? undefined, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('loadInventory')
  async load(
    @CurrentUser() user: JWTPayload,
    @Args('loadInventoryInput') input: LoadInventoryInput,
  ) {
    return this.batchService.load(input, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('sendInventory')
  async send(
    @CurrentUser() user: JWTPayload,
    @Args('sendInventoryInput') input: SendInventoryInput,
  ) {
    return this.batchService.send(input, user);
  }

  // Los mismos roles que crean inventarios: quien abre un inventario con
  // existencias puede registrar después sus entradas y salidas.
  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createInventoryMovement')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createInventoryMovementInput')
    createInput: CreateInventoryMovementInput,
  ) {
    return this.movementService.register(createInput, user);
  }

  // Traslado entre dos inventarios de la misma empresa: administrador o más.
  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('transferInventory')
  async transfer(
    @CurrentUser() user: JWTPayload,
    @Args('transferInventoryInput') transferInput: TransferInventoryInput,
  ) {
    return this.movementService.transfer(transferInput, user);
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
