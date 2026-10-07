import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateInventoryInput } from '../dto/create-inventory.input';
import { UpdateInventoryInput } from '../dto/update-inventory.input';
import { BaseService } from '../../../../core/services/base.service';
import { Inventory } from '../entities/inventory.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { ProductService } from '../../product/services/product.service';
import { InventoryMovementService } from '../../inventory-movement/services/inventory-movement.service';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
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
    @Inject(forwardRef(() => InventoryMovementService))
    private movementService: InventoryMovementService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(inventoryRepository);
  }

  /**
   * Abre el inventario de un producto en una oficina. Las existencias
   * iniciales entran como un movimiento `INITIAL_INVENTORY`, en la misma
   * transacción.
   */
  async create(
    createInventoryInput: CreateInventoryInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory> {
    if (!manager) {
      return this.inventoryRepository.manager.transaction((txManager) =>
        this.create(createInventoryInput, cu, scopes, txManager),
      );
    }

    const { productId, currentStock, ...rest } = createInventoryInput;
    const location = rest.location?.trim() || undefined;

    const product = await this.productService.findOne(
      productId,
      cu,
      scopes,
      manager,
    );

    // El inventario hereda el lugar del producto; lo que el producto deja
    // libre lo pone el usuario (su propio lugar o el que eligió).
    const validateScope = (
      label: string,
      entityId?: number,
      userScopeId?: number,
    ) => {
      if (entityId && userScopeId && entityId !== userScopeId) {
        throw new ConflictError(`El producto no pertenece a ${label}`);
      }
    };
    validateScope('tu empresa', product.business?.id, cu?.businessId);
    validateScope('tu oficina', product.office?.id, cu?.officeId);
    validateScope('tu departamento', product.department?.id, cu?.departmentId);
    validateScope('tu equipo', product.team?.id, cu?.teamId);

    const getScopeEntity = <T extends { id?: number | null }>(
      productEntity: T | undefined | null,
      userScopeId: number | undefined,
      inputScopeId: number | undefined,
    ): T | undefined => {
      if (productEntity?.id) return productEntity;
      const id = userScopeId || inputScopeId;
      return id ? ({ id } as T) : undefined;
    };

    const inventory: Inventory = {
      minStock: rest.minStock,
      location,
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

    if (!inventory.office?.id) {
      throw new BadRequestError('Indica la oficina donde está el inventario');
    }
    await this.assertNotDuplicated(
      productId,
      inventory.office.id,
      location,
      undefined,
      manager,
    );

    const invCreated = await super.baseCreate({
      data: inventory,
      cu,
      scopes,
      manager,
    });

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
      invCreated.currentStock = currentStock;
    }

    return invCreated;
  }

  /**
   * Un producto tiene un solo inventario por ubicación dentro de cada
   * oficina; si no, las existencias se reparten sin que nadie sepa dónde.
   */
  private async assertNotDuplicated(
    productId: number,
    officeId: number,
    location: string | undefined,
    exceptId: number | undefined,
    manager: EntityManager,
  ): Promise<void> {
    const sameOffice = await manager.getRepository(Inventory).find({
      where: { product: { id: productId }, office: { id: officeId } },
    });
    const normalize = (value?: string) => (value ?? '').trim().toLowerCase();
    const duplicated = sameOffice.find(
      (other) =>
        other.id !== exceptId &&
        normalize(other.location) === normalize(location),
    );
    if (duplicated) {
      throw new ConflictError(
        location
          ? `Este producto ya tiene un inventario en «${location}» de esa oficina`
          : 'Este producto ya tiene un inventario sin ubicación en esa oficina: indica una ubicación distinta',
      );
    }
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
        'product.category',
        'product.unitOfMeasure',
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
        product: { category: true, unitOfMeasure: true },
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
    const repository =
      manager?.getRepository(Inventory) ?? this.inventoryRepository;
    return repository.find({
      where: { product: { id: productId } },
      relations: { product: true, office: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Suma (o resta) existencias. El stock se suma en la propia sentencia:
   * leerlo y escribirlo por separado pierde unidades cuando dos ventas tocan
   * el mismo producto.
   */
  async adjust(
    id: number,
    adjustment: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory> {
    const inventory = await super.baseFindOne({
      id,
      relationsToLoad: { product: true },
      cu,
      scopes,
      manager,
    });

    const repository =
      manager?.getRepository(Inventory) ?? this.inventoryRepository;
    const result = await repository
      .createQueryBuilder()
      .update(Inventory)
      .set({ currentStock: () => '"currentStock" + :adjustment' })
      .where('id = :id AND "currentStock" + :adjustment >= 0', {
        id,
        adjustment,
      })
      .execute();

    if (!result.affected) {
      const where = inventory.location ? ` en «${inventory.location}»` : '';
      throw new ConflictError(
        `No hay existencias suficientes de "${inventory.product?.name}"${where}: hay ${inventory.currentStock} y se quieren sacar ${-adjustment}`,
      );
    }

    return { ...inventory, currentStock: inventory.currentStock + adjustment };
  }

  async update(
    id: number,
    updateInventoryInput: UpdateInventoryInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory> {
    const inventory = await super.baseFindOne({
      id,
      relationsToLoad: { product: true, office: true },
      cu,
      scopes,
      manager,
    });

    // `null` vacía un dato; si no llega, se queda como estaba
    const data: Partial<Inventory> = {};
    if (updateInventoryInput.minStock !== undefined) {
      data.minStock = updateInventoryInput.minStock as number;
    }
    if (updateInventoryInput.location !== undefined) {
      const location = updateInventoryInput.location?.trim() || undefined;
      if (inventory.office?.id) {
        await this.assertNotDuplicated(
          inventory.product.id as number,
          inventory.office.id,
          location,
          id,
          manager ?? this.inventoryRepository.manager,
        );
      }
      data.location = (location ?? null) as string;
    }

    return super.baseUpdate({
      id,
      data,
      cu,
      scopes,
      manager,
    });
  }

  /**
   * Elimina inventarios vacíos. Sus movimientos se conservan: son el
   * historial de lo que entró y salió, y las ventas apuntan a ellos.
   */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Inventory[]> {
    const inventories = await super.baseFindByIds({
      ids,
      relationsToLoad: { product: true },
      cu,
      scopes,
      manager,
    });

    const withStock = inventories.find((inventory) => inventory.currentStock);
    if (withStock) {
      const where = withStock.location ? ` en «${withStock.location}»` : '';
      throw new ConflictError(
        `No se puede eliminar: quedan ${withStock.currentStock} unidades de "${withStock.product?.name}"${where}. Registra antes su salida.`,
      );
    }

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
      relationsToLoad: { product: true, office: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedInventories = inventories.filter((i) => i.deletedAt);
    if (deletedInventories.length === 0) return 0;

    const orphan = deletedInventories.find((i) => i.product?.deletedAt);
    if (orphan) {
      throw new ConflictError(
        `El producto "${orphan.product.name}" está eliminado: restáuralo primero`,
      );
    }
    const repository =
      manager?.getRepository(Inventory) ?? this.inventoryRepository;
    for (const inventory of deletedInventories) {
      if (!inventory.office?.id) continue;
      const active = await repository.find({
        where: {
          product: { id: inventory.product.id },
          office: { id: inventory.office.id },
          deletedAt: IsNull(),
        },
      });
      const normalize = (value?: string) => (value ?? '').trim().toLowerCase();
      if (
        active.some(
          (other) =>
            normalize(other.location) === normalize(inventory.location),
        )
      ) {
        throw new ConflictError(
          `Ya hay otro inventario de "${inventory.product.name}" en esa ubicación`,
        );
      }
    }

    return super.baseRestoreDeletedMany({
      ids: deletedInventories.map((i) => i.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
