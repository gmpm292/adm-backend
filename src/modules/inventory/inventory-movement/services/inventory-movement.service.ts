/* eslint-disable @typescript-eslint/no-unused-vars */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateInventoryMovementInput } from '../dto/create-inventory-movement.input';
import { UpdateInventoryMovementInput } from '../dto/update-inventory-movement.input';
import { BaseService } from '../../../../core/services/base.service';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { UsersService } from '../../../users/services/users.service';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';

@Injectable()
export class InventoryMovementService extends BaseService<InventoryMovement> {
  constructor(
    @InjectRepository(InventoryMovement)
    private movementRepository: Repository<InventoryMovement>,
    @Inject(forwardRef(() => InventoryService))
    private inventoryService: InventoryService,
    private userService: UsersService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(movementRepository);
  }

  async create(
    createMovementInput: CreateInventoryMovementInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<InventoryMovement> {
    const { inventoryId, ...rest } = createMovementInput;

    const [inventory, user] = await Promise.all([
      this.inventoryService.findOne(inventoryId, cu, scopes, manager),
      this.userService.findOne(
        createMovementInput.userId,
        undefined,
        cu,
        scopes,
        manager,
      ),
    ]);

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const movement: InventoryMovement = {
      ...rest,
      inventory,
      user,
    };

    // Update inventory stock
    const adjustment =
      createMovementInput.type === 'IN'
        ? createMovementInput.quantity
        : -createMovementInput.quantity;
    await this.inventoryService.adjust(
      inventory.id as number,
      adjustment,
      createMovementInput.reason,
      cu,
      scopes,
      manager,
    );

    return super.baseCreate({
      data: movement,
      cu,
      scopes,
      manager,
    });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
      relationsToLoad: ['inventory', 'user'],
      cu,
      scopes,
      manager,
    });
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<InventoryMovement> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        inventory: true,
        user: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findByInventory(
    inventoryId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<InventoryMovement[]> {
    await this.inventoryService.findOne(inventoryId, cu, scopes, manager);
    return this.movementRepository.find({
      where: { inventory: { id: inventoryId } },
      relations: ['inventory', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: number,
    updateMovementInput: UpdateInventoryMovementInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<InventoryMovement> {
    const movement = await super.baseFindOne({ id, cu, scopes, manager });
    if (!movement) {
      throw new NotFoundError();
    }

    // Handle inventory updates if quantity or type changes
    if (updateMovementInput.quantity || updateMovementInput.type) {
      const oldAdjustment =
        movement.type === 'IN' ? movement.quantity : -movement.quantity;
      const newAdjustment =
        updateMovementInput.type === 'IN'
          ? (updateMovementInput.quantity ?? movement.quantity)
          : -(updateMovementInput.quantity ?? movement.quantity);

      const adjustmentDiff = newAdjustment - oldAdjustment;

      await this.inventoryService.adjust(
        movement.inventory.id as number,
        adjustmentDiff,
        updateMovementInput.reason || movement.reason,
        cu,
        scopes,
        manager,
      );
    }

    const { inventoryId, userId, ...rest } = updateMovementInput;
    return super.baseUpdate({
      id,
      data: { ...movement, ...rest },
      cu,
      scopes,
      manager,
    });
  }

  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<InventoryMovement[]> {
    const movements = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventory: true },
      cu,
      scopes,
      manager,
    });

    if (movements.length === 0) {
      throw new NotFoundError('No movements found.');
    }

    // Reverse the inventory adjustments
    await Promise.all(
      movements.map((movement) => {
        const adjustment =
          movement.type === 'IN' ? -movement.quantity : movement.quantity;
        return this.inventoryService.adjust(
          movement.inventory.id as number,
          adjustment,
          `Reversing movement ${movement.id}`,
          cu,
          scopes,
          manager,
        );
      }),
    );

    return super.baseDeleteMany({
      ids: movements.map((m) => m.id) as Array<number>,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const movements = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventory: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedMovements = movements.filter((m) => m.deletedAt);
    if (deletedMovements.length === 0) return 0;

    // Re-apply the inventory adjustments
    await Promise.all(
      deletedMovements.map((movement) => {
        const adjustment =
          movement.type === 'IN' ? movement.quantity : -movement.quantity;
        return this.inventoryService.adjust(
          movement.inventory.id as number,
          adjustment,
          `Restoring movement ${movement.id}`,
          cu,
          scopes,
          manager,
        );
      }),
    );

    return super.baseRestoreDeletedMany({
      ids: deletedMovements.map((m) => m.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
