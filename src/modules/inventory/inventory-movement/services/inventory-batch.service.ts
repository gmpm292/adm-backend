import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Role } from '../../../../core/enums/role.enum';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ForbiddenResourceError } from '../../../../core/errors/appErrors/ForbiddenResourceError';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Office } from '../../../company/office/entities/co_office.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { InventoryService } from '../../inventory/services/inventory.service';
import { Product } from '../../product/entities/product.entity';
import {
  InventoryLineInput,
  LoadInventoryInput,
  SendInventoryInput,
} from '../dto/inventory-batch.input';
import { INVENTORY_TRANSFER_REASON } from '../enums/movement-reason';
import { InventoryMovementService } from './inventory-movement.service';

/**
 * Las operaciones de la hoja trabajan con toda la empresa: un envío toca el
 * inventario de otra oficina, fuera del alcance de oficina de un ADMIN. Quién
 * puede usar cada oficina lo decide `officeFor`.
 */
const BATCH_SCOPES = [ScopedAccessEnum.BUSINESS];

export interface InventorySheet {
  office: Office;
  destinations: Office[];
  rows: Array<{
    product: Product;
    inventories: Inventory[];
    destinationStock: number | null;
  }>;
}

export interface InventoryBatchResult {
  lines: number;
  units: number;
  createdInventories: number;
}

/**
 * Hoja de inventario: todos los productos de la empresa con sus existencias
 * en una oficina, para cargar (entrada) o enviar a otra oficina varias líneas
 * de una vez. Todo o nada: cada operación va en una transacción.
 */
@Injectable()
export class InventoryBatchService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
    private readonly movementService: InventoryMovementService,
  ) {}

  /**
   * Productos de la empresa de la oficina con sus inventarios en ella. Con
   * `toOfficeId`, también lo que hay de cada uno en esa otra oficina.
   */
  async sheet(
    officeId: number,
    toOfficeId: number | undefined,
    cu: JWTPayload,
  ): Promise<InventorySheet> {
    const db = this.inventoryRepository.manager;
    const office = await this.officeFor(cu, officeId, db);
    const businessId = office.business?.id as number;
    const destinations = await db.getRepository(Office).find({
      where: { business: { id: businessId }, id: Not(office.id as number) },
      relations: { business: true },
      order: { name: 'ASC' },
    });
    const to = toOfficeId
      ? this.destinationIn(destinations, toOfficeId)
      : undefined;

    const [products, inventories] = await Promise.all([
      db.getRepository(Product).find({
        where: { business: { id: businessId } },
        relations: { category: true, unitOfMeasure: true },
        order: { name: 'ASC' },
      }),
      db.getRepository(Inventory).find({
        where: {
          office: { id: In([office.id, to?.id].filter(Boolean) as number[]) },
        },
        relations: { product: true, office: true },
        order: { location: 'ASC' },
      }),
    ]);

    return {
      office,
      destinations,
      rows: products.map((product) => {
        const own = inventories.filter((i) => i.product?.id === product.id);
        return {
          product,
          inventories: own.filter((i) => i.office?.id === office.id),
          destinationStock: to
            ? own
                .filter((i) => i.office?.id === to.id)
                .reduce((sum, i) => sum + i.currentStock, 0)
            : null,
        };
      }),
    };
  }

  /**
   * Entrada en una oficina, una línea por inventario. Una línea con solo el
   * producto abre su inventario en la oficina (sin ubicación) y entra en él.
   */
  async load(
    input: LoadInventoryInput,
    cu: JWTPayload,
  ): Promise<InventoryBatchResult> {
    this.assertDistinctLines(input.lines);
    const note = input.note?.trim() || undefined;

    return this.inventoryRepository.manager.transaction(async (manager) => {
      const office = await this.officeFor(cu, input.officeId, manager);
      let createdInventories = 0;

      for (const line of input.lines) {
        let inventoryId = line.inventoryId;
        if (inventoryId) {
          await this.inventoryIn(office, inventoryId, manager);
        } else if (line.productId) {
          // Si lo abrieron mientras tanto (otra pestaña), entra en el primero
          const existing = await manager.getRepository(Inventory).findOne({
            where: {
              product: { id: line.productId },
              office: { id: office.id },
            },
            order: { id: 'ASC' },
          });
          inventoryId =
            existing?.id ??
            (await this.open(line.productId, office, undefined, cu, manager))
              .id;
          if (!existing) createdInventories++;
        } else {
          throw new BadRequestError(
            'Cada línea lleva un inventario o un producto',
          );
        }

        await this.movementService.create(
          {
            inventoryId: inventoryId as number,
            type: 'IN',
            quantity: line.quantity,
            reason: input.reason,
            referenceId: note,
          },
          cu,
          BATCH_SCOPES,
          manager,
        );
      }

      return this.result(input.lines, createdInventories);
    });
  }

  /**
   * Envío a otra oficina de la misma empresa: por cada línea, una salida del
   * inventario de origen y una entrada en el destino, todas unidas por el
   * mismo `reservationId`. El destino es el inventario del producto con la
   * misma ubicación, si no el que no tiene ubicación, si no el primero; si el
   * producto no tiene ninguno allí, se abre con la ubicación del origen.
   */
  async send(
    input: SendInventoryInput,
    cu: JWTPayload,
  ): Promise<InventoryBatchResult> {
    if (input.fromOfficeId === input.toOfficeId) {
      throw new BadRequestError('Elige una oficina de destino distinta');
    }
    if (input.lines.some((line) => !line.inventoryId)) {
      throw new BadRequestError('Cada línea sale de un inventario del origen');
    }
    this.assertDistinctLines(input.lines);
    const note = input.note?.trim();
    const withNote = (text: string) =>
      (note ? `${text}. ${note}` : text).slice(0, 255);

    return this.inventoryRepository.manager.transaction(async (manager) => {
      const from = await this.officeFor(cu, input.fromOfficeId, manager);
      const to = await manager.getRepository(Office).findOne({
        where: { id: input.toOfficeId },
        relations: { business: true },
      });
      if (!to || to.business?.id !== from.business?.id) {
        throw new BadRequestError(
          'Solo se envía a otra oficina de la misma empresa',
        );
      }

      const reservationId = randomUUID();
      let createdInventories = 0;
      for (const line of input.lines) {
        const origin = await this.inventoryIn(
          from,
          line.inventoryId as number,
          manager,
        );
        let destination = await this.destinationFor(origin, to, manager);
        if (!destination) {
          destination = await this.open(
            origin.product?.id as number,
            to,
            origin.location,
            cu,
            manager,
          );
          createdInventories++;
        }

        const place = (inventory: Inventory, office: Office) =>
          [office.name, inventory.location].filter(Boolean).join(' · ');
        const base = {
          quantity: line.quantity,
          reason: INVENTORY_TRANSFER_REASON,
          reservationId,
        };
        // La salida va primero: si no hay existencias, falla todo el envío
        await this.movementService.create(
          {
            ...base,
            inventoryId: origin.id as number,
            type: 'OUT',
            referenceId: withNote(`Hacia ${place(destination, to)}`),
          },
          cu,
          BATCH_SCOPES,
          manager,
        );
        await this.movementService.create(
          {
            ...base,
            inventoryId: destination.id as number,
            type: 'IN',
            referenceId: withNote(`Desde ${place(origin, from)}`),
          },
          cu,
          BATCH_SCOPES,
          manager,
        );
      }

      return this.result(input.lines, createdInventories);
    });
  }

  /**
   * La oficina, si el usuario puede usarla como origen: SUPER cualquiera;
   * PRINCIPAL las de su empresa; el resto (ADMIN) solo la suya.
   */
  private async officeFor(
    cu: JWTPayload,
    officeId: number,
    db: EntityManager,
  ): Promise<Office> {
    const office = await db.getRepository(Office).findOne({
      where: { id: officeId },
      relations: { business: true },
    });
    if (!office) throw new NotFoundError('No se encontró la oficina');

    const roles = cu.role ?? [];
    if (roles.includes(Role.SUPER)) return office;
    if (office.business?.id !== cu.businessId) {
      throw new ForbiddenResourceError('Esa oficina no es de tu empresa');
    }
    if (!roles.includes(Role.PRINCIPAL) && office.id !== cu.officeId) {
      throw new ForbiddenResourceError(
        'Solo puedes cargar o enviar desde tu oficina',
      );
    }
    return office;
  }

  private destinationIn(destinations: Office[], toOfficeId: number): Office {
    const to = destinations.find((office) => office.id === toOfficeId);
    if (!to) {
      throw new BadRequestError(
        'La oficina de destino tiene que ser otra de la misma empresa',
      );
    }
    return to;
  }

  /** El inventario, que debe ser de la oficina */
  private async inventoryIn(
    office: Office,
    inventoryId: number,
    db: EntityManager,
  ): Promise<Inventory> {
    const inventory = await db.getRepository(Inventory).findOne({
      where: { id: inventoryId },
      relations: { product: true, office: true },
    });
    if (!inventory || inventory.office?.id !== office.id) {
      throw new BadRequestError(
        `Hay un inventario que no es de ${office.name}: vuelve a cargar la hoja`,
      );
    }
    return inventory;
  }

  /** Inventario del mismo producto en la oficina destino (ver `send`) */
  private async destinationFor(
    origin: Inventory,
    to: Office,
    db: EntityManager,
  ): Promise<Inventory | undefined> {
    const candidates = await db.getRepository(Inventory).find({
      where: { product: { id: origin.product?.id }, office: { id: to.id } },
      order: { id: 'ASC' },
    });
    const normalize = (value?: string | null) =>
      (value ?? '').trim().toLowerCase();
    return (
      candidates.find(
        (i) => normalize(i.location) === normalize(origin.location),
      ) ??
      candidates.find((i) => !normalize(i.location)) ??
      candidates[0]
    );
  }

  /** Abre a cero el inventario del producto en la oficina */
  private open(
    productId: number,
    office: Office,
    location: string | undefined,
    cu: JWTPayload,
    manager: EntityManager,
  ): Promise<Inventory> {
    return this.inventoryService.create(
      {
        productId,
        officeId: office.id,
        businessId: office.business?.id,
        location,
        currentStock: 0,
      },
      cu,
      BATCH_SCOPES,
      manager,
    );
  }

  /** Dos líneas del mismo inventario (o producto nuevo) se suman a mano */
  private assertDistinctLines(lines: InventoryLineInput[]): void {
    const keys = lines.map((line) =>
      line.inventoryId ? `i${line.inventoryId}` : `p${line.productId}`,
    );
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestError('Hay dos líneas del mismo inventario');
    }
  }

  private result(
    lines: InventoryLineInput[],
    createdInventories: number,
  ): InventoryBatchResult {
    return {
      lines: lines.length,
      units: lines.reduce((sum, line) => sum + line.quantity, 0),
      createdInventories,
    };
  }
}
