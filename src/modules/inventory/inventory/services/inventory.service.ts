import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateInventoryInput } from '../dto/create-inventory.input';
import { UpdateInventoryInput } from '../dto/update-inventory.input';
import { BaseService } from '../../../../core/services/base.service';
import { Inventory } from '../entities/inventory.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { ProductService } from '../../product/services/product.service';
import { InventoryMovementService } from '../../inventory-movement/services/inventory-movement.service';

@Injectable()
export class InventoryService extends BaseService<Inventory> {
  constructor(
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService,
    private movementService: InventoryMovementService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(inventoryRepository);
  }

  async create(
    createInventoryInput: CreateInventoryInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory> {
    const { productId, ...rest } = createInventoryInput;

    const product = await this.productService.findOne(
      productId,
      cu,
      scopes,
      manager,
    );
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const inventory: Inventory = {
      ...rest,
      product,
    };

    return super.baseCreate({
      data: inventory,
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
      relationsToLoad: ['product', 'inventoryMovements'],
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
  ): Promise<Inventory> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        product: true,
        inventoryMovements: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findByProduct(
    productId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory[]> {
    await this.productService.findOne(productId, cu, scopes, manager);
    return this.inventoryRepository.find({
      where: { product: { id: productId } },
      relations: ['product', 'inventoryMovements'],
    });
  }

  async adjust(
    id: number,
    adjustment: number,
    reason: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory> {
    const inventory = await super.baseFindOne({ id, cu, scopes, manager });
    if (!inventory) {
      throw new NotFoundError();
    }

    const newStock = inventory.currentStock + adjustment;
    if (newStock < 0) {
      throw new Error('Cannot adjust inventory below zero');
    }

    // // Create movement record
    // await this.movementService.create(
    //   {
    //     inventoryId: inventory.id as number,
    //     userId: cu?.sub as number,
    //     type: adjustment > 0 ? 'IN' : 'OUT',
    //     quantity: Math.abs(adjustment),
    //     reason,
    //   },
    //   cu,
    //   scopes,
    //   manager,
    // );

    return super.baseUpdate({
      id,
      data: { ...inventory, currentStock: newStock },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateInventoryInput: UpdateInventoryInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory> {
    const inventory = await super.baseFindOne({ id, cu, scopes, manager });
    if (!inventory) {
      throw new NotFoundError();
    }

    if (updateInventoryInput.productId) {
      const product = await this.productService.findOne(
        updateInventoryInput.productId,
        cu,
        scopes,
        manager,
      );
      if (!product) {
        throw new NotFoundError('Product not found');
      }
      inventory.product = product;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { productId, ...rest } = updateInventoryInput;
    return super.baseUpdate({
      id,
      data: { ...inventory, ...rest },
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
  ): Promise<Inventory[]> {
    const inventories = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventoryMovements: true },
      cu,
      scopes,
      manager,
    });

    if (inventories.length === 0) {
      throw new NotFoundError('No inventories found.');
    }

    await Promise.all(
      inventories.map((inventory) =>
        inventory.inventoryMovements?.length
          ? this.movementService.remove(
              inventory.inventoryMovements.map((m) => m.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseDeleteMany({
      ids: inventories.map((i) => i.id) as Array<number>,
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

    const inventories = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventoryMovements: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedInventories = inventories.filter((i) => i.deletedAt);
    if (deletedInventories.length === 0) return 0;

    await Promise.all(
      deletedInventories.map((inventory) =>
        inventory.inventoryMovements?.length
          ? this.movementService.restore(
              inventory.inventoryMovements
                .filter((m) => m.deletedAt)
                .map((m) => m.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseRestoreDeletedMany({
      ids: deletedInventories.map((i) => i.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
