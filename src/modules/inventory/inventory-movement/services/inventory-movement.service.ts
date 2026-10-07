import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateInventoryMovementInput } from '../dto/create-inventory-movement.input';
import { BaseService } from '../../../../core/services/base.service';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { UsersService } from '../../../users/services/users.service';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { MANUAL_MOVEMENT_REASONS } from '../enums/movement-reason';

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

  /**
   * Entrada o salida registrada a mano. Solo admite los motivos de
   * `MANUAL_MOVEMENT_REASONS`: los de venta y el inventario inicial los pone
   * el sistema.
   */
  async register(
    input: CreateInventoryMovementInput,
    cu?: JWTPayload,
  ): Promise<InventoryMovement> {
    if (!MANUAL_MOVEMENT_REASONS[input.type]?.includes(input.reason)) {
      throw new BadRequestError(
        'Ese motivo no es válido para este tipo de movimiento',
      );
    }
    const referenceId = input.referenceId?.trim() || undefined;

    return this.create(
      {
        inventoryId: input.inventoryId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        referenceId,
      },
      cu,
    );
  }

  /**
   * Registra el movimiento y ajusta las existencias del inventario. Sin
   * `manager` abre su propia transacción: el ajuste y el registro van juntos.
   */
  async create(
    createMovementInput: CreateInventoryMovementInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<InventoryMovement> {
    if (!manager) {
      return this.movementRepository.manager.transaction((txManager) =>
        this.create(createMovementInput, cu, scopes, txManager),
      );
    }

    const { inventoryId, isReservation, ...rest } = createMovementInput;
    if (!rest.quantity || rest.quantity <= 0) {
      throw new BadRequestError('La cantidad debe ser mayor que cero');
    }

    const [inventory, user] = await Promise.all([
      this.inventoryService.findOne(inventoryId, cu, scopes, manager),
      this.userService.findOne(
        cu?.sub as number,
        undefined,
        cu,
        scopes,
        manager,
      ),
    ]);

    if (!inventory) {
      throw new NotFoundError('No se encontró el inventario');
    }
    if (!user) {
      throw new NotFoundError('No se encontró el usuario');
    }

    const movement: InventoryMovement = {
      ...rest,
      inventory,
      user,
      isReservation: isReservation || false,
      business: inventory.business,
      office: inventory.office,
      department: inventory.department,
      team: inventory.team,
    };

    await this.inventoryService.adjust(
      inventory.id as number,
      rest.type === 'IN' ? rest.quantity : -rest.quantity,
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

  /**
   * El historial incluye los movimientos de inventarios y productos ya
   * eliminados: sin `withDeleted` esas relaciones llegarían vacías.
   */
  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const notDeleted = options?.withDeleted
      ? []
      : [{ property: 'deletedAt', operator: ConditionalOperator.IS_NULL }];
    return await super.baseFind({
      options: {
        skip: 0,
        take: 10,
        ...options,
        withDeleted: true,
        filters: [...(options?.filters ?? []), ...notDeleted],
      },
      relationsToLoad: [
        'inventory',
        'inventory.product',
        'product.category',
        'product.unitOfMeasure',
        'user',
        'office',
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
  ): Promise<InventoryMovement> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        inventory: { product: { category: true, unitOfMeasure: true } },
        user: true,
        business: true,
        office: true,
        department: true,
        team: true,
        createdBy: true,
        updatedBy: true,
        deletedBy: true,
      },
      withDeleted: true,
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
}
