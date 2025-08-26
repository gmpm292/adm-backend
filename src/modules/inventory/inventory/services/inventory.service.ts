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
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { Business } from '../../../company/business/entities/co_business.entity';
import { Office } from '../../../company/office/entities/co_office.entity';
import { Department } from '../../../company/department/entities/co_department.entity';
import { Team } from '../../../company/team/entities/co_team.entity';

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
    const { productId, currentStock, ...rest } = createInventoryInput;

    // 1. Obtener el producto
    const product = await this.productService.findOne(
      productId,
      cu,
      scopes,
      manager,
    );
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // 2. Validar que los scopes del producto coincidan con el usuario actual
    const validateScope = (
      scopeName: string,
      entityId?: number,
      userScopeId?: number,
    ) => {
      if (entityId && userScopeId && entityId !== userScopeId) {
        throw new ConflictError(
          `Product ${scopeName} does not match user ${scopeName}`,
        );
      }
    };

    validateScope('business', product.business?.id, cu?.businessId);
    validateScope('office', product.office?.id, cu?.officeId);
    validateScope('department', product.department?.id, cu?.departmentId);
    validateScope('team', product.team?.id, cu?.teamId);

    // 3. Función para determinar el scope
    const getScopeEntity = <T extends { id?: number | null }>(
      productEntity: T | undefined | null,
      userScopeId: number | undefined,
      inputScopeId: number | undefined,
    ): T | undefined => {
      if (productEntity?.id) return productEntity;
      const id = userScopeId || inputScopeId;
      return id ? ({ id } as T) : undefined;
    };

    // 4. Crear el objeto de inventario
    const inventory: Inventory = {
      ...rest,
      product,
      business: getScopeEntity<Business>(
        product.business,
        cu?.businessId,
        rest.businessId,
      ),
      office: getScopeEntity<Office>(
        product.office,
        cu?.officeId,
        rest.officeId,
      ),
      department: getScopeEntity<Department>(
        product.department,
        cu?.departmentId,
        rest.departmentId,
      ),
      team: getScopeEntity<Team>(product.team, cu?.teamId, rest.teamId),
      currentStock: 0,
    };

    // 5. Crear el inventario
    const invCreated = await super.baseCreate({
      data: inventory,
      cu,
      scopes,
      manager,
    });

    // 6. Registrar movimiento inicial si corresponde
    if (currentStock > 0) {
      await this.movementService.create(
        {
          inventoryId: invCreated.id as number,
          type: 'IN',
          quantity: currentStock,
          reason: 'INITIAL_INVENTORY',
        },
        cu,
        scopes,
        manager,
      );
    }

    return invCreated;
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
      relationsToLoad: [
        'product',
        'inventoryMovements',
        'business',
        'office',
        'department',
        'team',
      ],
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
        product: { category: true },
        //inventoryMovements: { user: true },
        business: true,
        office: true,
        department: true,
        team: true,
        createdBy: true,
        updatedBy: true,
        deletedBy: true,
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
      throw new ConflictError('Cannot adjust inventory below zero');
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

    // if (updateInventoryInput.productId) {
    //   const product = await this.productService.findOne(
    //     updateInventoryInput.productId,
    //     cu,
    //     scopes,
    //     manager,
    //   );
    //   if (!product) {
    //     throw new NotFoundError('Product not found');
    //   }
    //   inventory.product = product;
    //   inventory.business = product.business;
    //   inventory.office = product.office;
    //   inventory.department = product.department;
    //   inventory.team = product.team;
    // }

    const { /*productId,*/ ...rest } = updateInventoryInput;
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
      relationsToLoad: { inventoryMovements: true, product: true },
      cu,
      scopes,
      manager,
    });

    if (inventories.length === 0) {
      throw new NotFoundError('No inventories found.');
    }

    await Promise.all(
      inventories.map((inventory) => {
        // Check if current stock is not zero
        if (inventory.currentStock !== 0) {
          throw new ConflictError(
            `Cannot proceed with operation. Inventory item ${inventory.product.name} has ${inventory.currentStock} units in stock. Stock must be zero to perform this action.`,
          );
        }

        return inventory.inventoryMovements?.length
          ? this.movementService.remove(
              inventory.inventoryMovements.map((m) => m.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve();
      }),
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
