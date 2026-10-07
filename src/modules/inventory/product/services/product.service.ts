import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';

import { CreateProductInput } from '../dto/create-product.input';
import { UpdateProductInput } from '../dto/update-product.input';
import { BaseService } from '../../../../core/services/base.service';
import { Product } from '../entities/product.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { CategoryService } from '../../category/services/category.service';
import { CurrencyService } from '../../../payroll/currency/services/currency.service';
import { ProductPaymentOptions } from '../types/product-payment-options.type';
import { InventoryMovementService } from '../../inventory-movement/services/inventory-movement.service';
import { ReserveReleaseReason } from '../enums/reserve-release-reason';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { InventoryMovement } from '../../inventory-movement/entities/inventory-movement.entity';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { UnitOfMeasureService } from '../../unit-of-measure/services/unit-of-measure.service';
import { MaterialCostService } from '../../../payroll/material-cost/services/material-cost.service';
import { MaterialCost } from '../../../payroll/material-cost/entities/material-cost.entity';

@Injectable()
export class ProductService extends BaseService<Product> {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private inventoryService: InventoryService,
    private inventoryMovementService: InventoryMovementService,
    @Inject(forwardRef(() => CategoryService))
    private categoryService: CategoryService,
    private unitOfMeasureService: UnitOfMeasureService,
    private materialCostService: MaterialCostService,

    protected scopedAccessService: ScopedAccessService,
    protected currencyService: CurrencyService,
  ) {
    super(productRepository);
  }

  async create(
    createProductInput: CreateProductInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Product> {
    const { categoryId, unitOfMeasureId, materialCostId, ...rest } =
      createProductInput;
    rest.name = rest.name.trim();
    this.assertValidRules(rest);

    const category = await this.categoryService.findOne(
      categoryId,
      cu,
      scopes,
      manager,
    );
    await this.assertUniqueName(rest.name, categoryId, undefined, manager);

    const unitOfMeasure = await this.unitOfMeasureService.findOne(
      unitOfMeasureId,
      cu,
      scopes,
      manager,
    );

    let materialCost: MaterialCost | undefined = undefined;
    if (materialCostId) {
      materialCost = await this.materialCostService.findOne(
        materialCostId,
        cu,
        scopes,
        manager,
      );
    }

    const product: Product = {
      ...rest,
      category,
      unitOfMeasure,
      materialCost,
      business: category.business,
      office: category.office,
      department: category.department,
      team: category.team,
    } as Product;

    return super.baseCreate({
      data: product,
      uniqueFields: [],
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
      relationsToLoad: [
        'category',
        'inventories',
        'unitOfMeasure',
        'materialCost',
        'materialCost.currency',
        'business',
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
  ): Promise<Product> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        category: true,
        inventories: true,
        unitOfMeasure: true,
        materialCost: { currency: true, unitOfMeasure: true },
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

  async findByCategory(
    categoryId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Product[]> {
    await this.categoryService.findOne(categoryId, cu, scopes, manager);
    return this.productRepository.find({
      where: { category: { id: categoryId } },
      relations: ['category', 'inventories', 'unitOfMeasure', 'materialCost'],
    });
  }

  async update(
    id: number,
    updateProductInput: UpdateProductInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Product> {
    const product = await super.baseFindOne({
      id,
      relationsToLoad: { category: true },
      cu,
      scopes,
      manager,
    });

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      id: _id,
      categoryId,
      unitOfMeasureId,
      materialCostId,
      businessId,
      officeId,
      departmentId,
      teamId,
      ...changes
    } = updateProductInput;
    /* eslint-enable @typescript-eslint/no-unused-vars */
    if (changes.name !== undefined) changes.name = changes.name.trim();

    // Lo que llega sustituye a lo guardado; lo que no llega se queda
    const data: Partial<Product> = { ...changes } as Partial<Product>;
    this.assertValidRules({ ...product, ...data });

    if (categoryId) {
      const category = await this.categoryService.findOne(
        categoryId,
        cu,
        scopes,
        manager,
      );
      data.category = category;
      data.business = category.business;
      data.office = category.office;
      data.department = category.department;
      data.team = category.team;
    }
    await this.assertUniqueName(
      data.name ?? product.name,
      categoryId ?? (product.category?.id as number),
      id,
      manager,
    );

    if (unitOfMeasureId) {
      data.unitOfMeasure = await this.unitOfMeasureService.findOne(
        unitOfMeasureId,
        cu,
        scopes,
        manager,
      );
    }

    // `null` quita el material; si no llega, se queda el que tenía
    if (materialCostId === null) {
      data.materialCost = null as unknown as MaterialCost;
    } else if (materialCostId !== undefined) {
      data.materialCost = await this.materialCostService.findOne(
        materialCostId,
        cu,
        scopes,
        manager,
      );
    }

    return super.baseUpdate({
      id,
      data,
      cu,
      scopes,
      manager,
    });
  }

  /** Reglas que el formulario ya comprueba, repetidas aquí por si acaso */
  private assertValidRules(
    product: Pick<Partial<Product>, 'saleRules' | 'pricingConfig'>,
  ): void {
    const min = product.saleRules?.minQuantity;
    const max = product.saleRules?.maxQuantity;
    if (min && max && min > max) {
      throw new BadRequestError(
        'La cantidad mínima de venta no puede ser mayor que la máxima',
      );
    }
    const fixed = product.pricingConfig?.fixedPrices ?? [];
    if (new Set(fixed.map((p) => p.currency)).size !== fixed.length) {
      throw new BadRequestError('Hay dos precios fijos en la misma moneda');
    }
  }

  /** Dos productos con el mismo nombre en una categoría son el mismo */
  private async assertUniqueName(
    name: string,
    categoryId: number,
    exceptId: number | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    const repository =
      manager?.getRepository(Product) ?? this.productRepository;
    const duplicated = await repository
      .createQueryBuilder('product')
      .where('LOWER(TRIM(product.name)) = LOWER(:name)', { name: name.trim() })
      .andWhere('"product"."categoryId" = :categoryId', { categoryId })
      .andWhere(exceptId ? 'product.id != :exceptId' : '1=1', { exceptId })
      .withDeleted()
      .getOne();
    if (duplicated) {
      throw new ConflictError(
        duplicated.deletedAt
          ? `Ya hay un producto eliminado llamado "${duplicated.name}" en esta categoría: restáuralo desde el listado`
          : `Ya hay un producto llamado "${duplicated.name}" en esta categoría`,
      );
    }
  }

  /**
   * Elimina productos sin existencias junto con sus inventarios (vacíos).
   * Las ventas y movimientos que los nombran se conservan.
   */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Product[]> {
    if (!manager) {
      return this.productRepository.manager.transaction((txManager) =>
        this.remove(ids, cu, scopes, txManager),
      );
    }

    const products = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventories: true },
      cu,
      scopes,
      manager,
    });

    for (const product of products) {
      const stock = (product.inventories ?? []).reduce(
        (sum, inventory) => sum + inventory.currentStock,
        0,
      );
      if (stock > 0) {
        throw new ConflictError(
          `No se puede eliminar "${product.name}": aún tiene ${stock} unidades en inventario. Registra antes su salida.`,
        );
      }
      if (product.inventories?.length) {
        await this.inventoryService.remove(
          product.inventories.map((i) => i.id) as number[],
          cu,
          scopes,
          manager,
        );
      }
    }

    return super.baseDeleteMany({
      ids: products.map((p) => p.id) as Array<number>,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  /** Restaura los productos y los inventarios que se eliminaron con ellos */
  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;
    if (!manager) {
      return this.productRepository.manager.transaction((txManager) =>
        this.restore(ids, cu, scopes, txManager),
      );
    }

    const products = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventories: true, category: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedProducts = products.filter((p) => p.deletedAt);
    if (deletedProducts.length === 0) return 0;

    for (const product of deletedProducts) {
      if (product.category?.deletedAt) {
        throw new ConflictError(
          `La categoría de "${product.name}" está eliminada: restáurala primero`,
        );
      }
      await this.assertUniqueName(
        product.name,
        product.category?.id as number,
        product.id,
        manager,
      );
    }

    const restored = await super.baseRestoreDeletedMany({
      ids: deletedProducts.map((p) => p.id) as Array<number>,
      cu,
      scopes,
      manager,
    });

    // Los inventarios se borraron con el producto, en el mismo instante
    for (const product of deletedProducts) {
      const inventoryIds = (product.inventories ?? [])
        .filter(
          (i) =>
            i.deletedAt &&
            Math.abs(
              new Date(i.deletedAt).getTime() -
                new Date(product.deletedAt as Date).getTime(),
            ) < 5000,
        )
        .map((i) => i.id as number);
      if (inventoryIds.length) {
        await this.inventoryService.restore(inventoryIds, cu, scopes, manager);
      }
    }

    return restored;
  }

  async calculatePaymentOptions(
    productId: number,
    quantity: number = 1,
    currency?: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ProductPaymentOptions> {
    const product = await super.baseFindOne({
      id: productId,
      cu,
      scopes,
      manager,
    });

    // Validar cantidad
    if (
      product.saleRules?.minQuantity &&
      quantity < product.saleRules.minQuantity
    ) {
      throw new BadRequestError(
        `La cantidad mínima de "${product.name}" es ${product.saleRules.minQuantity}`,
      );
    }

    if (
      product.saleRules?.maxQuantity &&
      quantity > product.saleRules.maxQuantity
    ) {
      throw new BadRequestError(
        `La cantidad máxima de "${product.name}" es ${product.saleRules.maxQuantity}`,
      );
    }

    // Validar moneda si fue introducida.
    if (currency && !this.acceptedCurrenciesOf(product).includes(currency)) {
      throw new BadRequestError(
        `La moneda ${currency} no se permite para este producto`,
      );
    }

    return this.buildPaymentOptions(product, quantity, currency);
  }

  /** Monedas en las que se puede cobrar el producto; su moneda base siempre. */
  private acceptedCurrenciesOf(product: Product): string[] {
    const accepted = product.pricingConfig?.acceptedCurrencies ?? [];
    return accepted.includes(product.baseCurrency)
      ? accepted
      : [product.baseCurrency, ...accepted];
  }

  /**
   * Precio del producto en cada moneda aceptada, sin validar las reglas de
   * cantidad (el catálogo de venta lo usa para mostrar precios unitarios).
   * Una moneda sin tasa de cambio configurada se omite, salvo que sea la
   * única pedida.
   */
  async buildPaymentOptions(
    product: Product,
    quantity: number = 1,
    currency?: string,
  ): Promise<ProductPaymentOptions> {
    const basePrice = Number(product.basePrice);
    const decimalPlaces = product.pricingConfig?.decimalPlaces ?? 2;
    const round = (value: number) => parseFloat(value.toFixed(decimalPlaces));
    const currencies = currency
      ? [currency]
      : this.acceptedCurrenciesOf(product);

    const bulkDiscount = (product.saleRules?.bulkDiscounts ?? [])
      .filter((d) => quantity >= d.minQty)
      .sort((a, b) => b.minQty - a.minQty)[0];

    const paymentOptions: ProductPaymentOptions['paymentOptions'] = [];
    for (const code of currencies) {
      const fixedPrice = product.pricingConfig?.fixedPrices?.find(
        (p) => p.currency === code,
      );

      let unitPrice: number;
      let exchangeRate: number | undefined;
      if (fixedPrice) {
        unitPrice = Number(fixedPrice.amount);
      } else if (code === product.baseCurrency) {
        unitPrice = basePrice;
      } else {
        try {
          exchangeRate = await this.currencyService.getExchangeRate(
            product.baseCurrency,
            code,
          );
        } catch {
          if (currency) {
            throw new BadRequestError(
              `No hay tasa de cambio configurada entre ${product.baseCurrency} y ${code}`,
            );
          }
          continue;
        }
        const marginMultiplier =
          1 + (product.pricingConfig?.exchangeRateMargin || 0) / 100;
        unitPrice = basePrice * exchangeRate * marginMultiplier;
      }

      if (bulkDiscount?.applicableCurrencies?.includes(code)) {
        unitPrice *= 1 - bulkDiscount.discount / 100;
      }

      unitPrice = round(unitPrice);
      paymentOptions.push({
        currency: code,
        unitPrice,
        total: round(unitPrice * quantity),
        isFixedPrice: !!fixedPrice,
        ...(exchangeRate !== undefined && { exchangeRate }),
      });
    }

    return {
      basePrice,
      baseCurrency: product.baseCurrency,
      paymentOptions,
      quantity,
      minQuantity: product.saleRules?.minQuantity,
      maxQuantity: product.saleRules?.maxQuantity,
    };
  }

  public async validateAndReserveStock(
    productId: number,
    quantity: number,
    reason: ReserveReleaseReason,
    referenceId: string, // ID de la transacción que causa la reserva
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
    reservationId = uuidv4(), // Si existe es un ajuste a una reserva anterior, sino generar un UUID único para esta reserva
  ): Promise<string> {
    // El inventario se lleva en unidades enteras.
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestError(
        'La cantidad debe ser un número entero mayor que cero',
      );
    }

    const inventory = await this.inventoryService.findByProduct(
      productId,
      cu,
      scopes,
      manager,
    );

    const availableStock = inventory.reduce(
      (sum, inv) => sum + inv.currentStock,
      0,
    );

    if (availableStock < quantity) {
      const name = inventory[0]?.product?.name ?? `#${productId}`;
      throw new BadRequestError(
        `Stock insuficiente de "${name}": disponible ${availableStock}, solicitado ${quantity}`,
      );
    }

    // Reservar stock usando FIFO
    let remainingQuantity = quantity;
    const sortedInventory = [...inventory].sort(
      (a, b) =>
        new Date(a.createdAt as Date).getTime() -
        new Date(b.createdAt as Date).getTime(),
    );

    for (const inventoryItem of sortedInventory) {
      if (remainingQuantity <= 0) break;
      const quantityToDeduct = Math.min(
        remainingQuantity,
        inventoryItem.currentStock,
      );

      if (quantityToDeduct > 0) {
        // Crear movimiento de salida
        await this.inventoryMovementService.create(
          {
            inventoryId: inventoryItem.id as number,
            type: 'OUT',
            quantity: quantityToDeduct,
            reason,
            isReservation: true,
            reservationId,
            referenceId,
          },
          cu,
          scopes,
          manager,
        );

        remainingQuantity -= quantityToDeduct;
      }
    }

    if (remainingQuantity > 0) {
      throw new BadRequestError(
        `No se pudo reservar todo el stock del producto #${productId}`,
      );
    }

    return reservationId;
  }

  public async releaseStock(
    productId: number,
    quantity: number,
    reason: ReserveReleaseReason,
    reservationId: string, // ID de la reserva original
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<void> {
    const movements = (
      await this.inventoryMovementService.find(
        {
          filters: [
            {
              property: 'reservationId',
              operator: ConditionalOperator.EQUAL,
              value: reservationId,
            },
          ],
        },
        cu,
        scopes,
        manager,
      )
    ).data as Array<InventoryMovement>;

    if (!movements || movements.length === 0) {
      // Ventas cargadas sin movimientos de inventario (datos importados): al
      // devolverlas la mercancía entra igualmente, al primer inventario.
      if (reason === ReserveReleaseReason.SALE_REFUND) {
        const [inventory] = await this.inventoryService.findByProduct(
          productId,
          cu,
          scopes,
          manager,
        );
        if (inventory) {
          await this.inventoryMovementService.create(
            {
              inventoryId: inventory.id as number,
              type: 'IN',
              quantity,
              reason,
              reservationId,
            },
            cu,
            scopes,
            manager,
          );
          return;
        }
      }
      throw new BadRequestError(
        `No se encontró la reserva de existencias ${reservationId}`,
      );
    }

    // Lo que sigue fuera de cada inventario: salidas menos lo ya devuelto.
    const outstanding = new Map<number, number>();
    for (const movement of movements) {
      const inventoryId = movement.inventory.id as number;
      const signed =
        movement.type === 'OUT' ? movement.quantity : -movement.quantity;
      outstanding.set(
        inventoryId,
        (outstanding.get(inventoryId) ?? 0) + signed,
      );
    }

    const totalOutstanding = [...outstanding.values()].reduce(
      (sum, value) => sum + Math.max(value, 0),
      0,
    );
    if (totalOutstanding < quantity) {
      throw new BadRequestError(
        `Se quieren devolver ${quantity} unidades pero solo salieron ${totalOutstanding}`,
      );
    }

    // El stock vuelve a los mismos inventarios de los que salió; si alguno se
    // eliminó después, al primer inventario activo del producto.
    const deleted = new Set(
      movements
        .filter((movement) => movement.inventory.deletedAt)
        .map((movement) => movement.inventory.id as number),
    );
    const [fallback] = deleted.size
      ? await this.inventoryService.findByProduct(
          productId,
          cu,
          scopes,
          manager,
        )
      : [];

    let remainingQuantity = quantity;
    for (const [inventoryId, pending] of outstanding) {
      if (remainingQuantity <= 0) break;
      const quantityToReturn = Math.min(remainingQuantity, pending);
      if (quantityToReturn <= 0) continue;

      const target = deleted.has(inventoryId) ? fallback?.id : inventoryId;
      if (!target) {
        throw new BadRequestError(
          'El inventario del que salió este producto ya no existe: crea uno para recibir la devolución',
        );
      }

      await this.inventoryMovementService.create(
        {
          inventoryId: target,
          type: 'IN',
          quantity: quantityToReturn,
          reason,
          reservationId, // Mismo ID de reserva
          referenceId: movements[0].referenceId, // Misma referencia
        },
        cu,
        scopes,
        manager,
      );

      remainingQuantity -= quantityToReturn;
    }
  }

  public async confirmSale(
    reservationId: string,
    saleReferenceId: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<void> {
    // Buscar todas las reservas con este reservationId
    const reservations = (
      await this.inventoryMovementService.find(
        {
          filters: [
            {
              property: 'reservationId',
              operator: ConditionalOperator.EQUAL,
              value: reservationId,
            },
            {
              property: 'isReservation',
              operator: ConditionalOperator.EQUAL,
              value: 'true',
            },
          ],
        },
        cu,
        scopes,
        manager,
      )
    ).data as Array<InventoryMovement>;

    if (!reservations || reservations.length === 0) {
      throw new BadRequestError(
        `No se encontró la reserva de existencias ${reservationId}`,
      );
    }

    // La reserva pasa a ser una salida por venta; la cantidad no cambia, así
    // que el stock no se toca.
    const repository =
      manager?.getRepository(InventoryMovement) ??
      this.inventoryMovementService.getRepository();
    await repository.update(
      reservations.map((movement) => movement.id as number),
      {
        isReservation: false,
        referenceId: saleReferenceId,
        reason: 'SALE_CONFIRMED',
        ...(cu && { updatedBy: { id: cu.sub } }),
      },
    );
  }
}

/** 

Pasos para el calculo (calculatePaymentOptions).

1- La conversión de moneda

2- Un margen adicional (si existe)

3- El redondeo a un número específico de decimales

Vamos a desglosarlo paso a paso:
1. Cálculo del multiplicador de margen:
typescript

const marginMultiplier = 1 + (product.pricingConfig.exchangeRateMargin || 0) / 100;

product.pricingConfig.exchangeRateMargin es un porcentaje de margen que se quiere añadir al precio

Si no existe (undefined), se usa 0 por defecto (|| 0)

Se divide entre 100 para convertirlo de porcentaje a decimal (ej: 5% → 0.05)

Se suma 1 para crear un multiplicador (ej: si el margen es 5%, el multiplicador será 1.05)

2. Cálculo del precio convertido:
typescript

const convertedPrice = product.basePrice * exchangeRate * marginMultiplier;

product.basePrice: Precio base del producto en su moneda original

exchangeRate: Tasa de conversión entre la moneda base y la moneda objetivo

marginMultiplier: El factor de margen calculado anteriormente

Multiplicando estos tres valores obtenemos el precio final en la moneda objetivo con el margen aplicado

3. Redondeo del precio:
typescript

const decimalPlaces = product.pricingConfig.decimalPlaces ?? 2;
const roundedPrice = parseFloat(convertedPrice.toFixed(decimalPlaces));

decimalPlaces: Número de decimales a usar (tomado de la configuración del producto, con 2 como valor por defecto si no está especificado)

toFixed(): Redondea el número al número de decimales especificado (pero devuelve un string)

parseFloat(): Convierte el string resultante de vuelta a número

4. Retorno del resultado:
typescript

return {
currency,                // Moneda objetivo
unitPrice: roundedPrice, // Precio por unidad después de conversión y margen
total: roundedPrice * quantity, // Precio total (unidad x cantidad)
isFixedPrice: false,     // Indica si es un precio fijo o calculado
exchangeRate,            // Tasa de cambio usada
};

 */
