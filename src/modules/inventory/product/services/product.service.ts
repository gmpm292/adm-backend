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
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
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

@Injectable()
export class ProductService extends BaseService<Product> {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private inventoryService: InventoryService,
    private inventoryMovementService: InventoryMovementService,
    @Inject(forwardRef(() => CategoryService))
    private categoryService: CategoryService,
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
    const { categoryId, ...rest } = createProductInput;

    const category = await this.categoryService.findOne(
      categoryId,
      cu,
      scopes,
      manager,
    );
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const product: Product = {
      ...rest,
      category,
    } as Product;

    return super.baseCreate({
      data: product,
      uniqueFields: ['name'],
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
      relationsToLoad: ['category', 'inventories'],
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
      relations: ['category', 'inventories'],
    });
  }

  async update(
    id: number,
    updateProductInput: UpdateProductInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Product> {
    const product = await super.baseFindOne({ id, cu, scopes, manager });
    if (!product) {
      throw new NotFoundError();
    }

    if (updateProductInput.categoryId) {
      const category = await this.categoryService.findOne(
        updateProductInput.categoryId,
        cu,
        scopes,
        manager,
      );
      if (!category) {
        throw new NotFoundError('Category not found');
      }
      product.category = category;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { categoryId, ...rest } = updateProductInput;
    return super.baseUpdate({
      id,
      data: { ...product, ...rest },
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
  ): Promise<Product[]> {
    const products = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventories: true },
      cu,
      scopes,
      manager,
    });

    if (products.length === 0) {
      throw new NotFoundError('No products found.');
    }

    await Promise.all(
      products.map((product) =>
        product.inventories?.length
          ? this.inventoryService.remove(
              product.inventories.map((i) => i.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseDeleteMany({
      ids: products.map((p) => p.id) as Array<number>,
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

    const products = await super.baseFindByIds({
      ids,
      relationsToLoad: { inventories: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedProducts = products.filter((p) => p.deletedAt);
    if (deletedProducts.length === 0) return 0;

    await Promise.all(
      deletedProducts.map((product) =>
        product.inventories?.length
          ? this.inventoryService.restore(
              product.inventories
                .filter((i) => i.deletedAt)
                .map((i) => i.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseRestoreDeletedMany({
      ids: deletedProducts.map((p) => p.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
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
      throw new Error(`La cantidad mínima es ${product.saleRules.minQuantity}`);
    }

    if (
      product.saleRules?.maxQuantity &&
      quantity > product.saleRules.maxQuantity
    ) {
      throw new Error(`La cantidad máxima es ${product.saleRules.maxQuantity}`);
    }

    // Validar moneda si fue introducida.
    if (
      currency &&
      product.pricingConfig.acceptedCurrencies.includes(currency)
    ) {
      throw new Error(`La moneda ${currency} no se permite para este producto`);
    }

    // Calcular opciones para la moneda dada o cada moneda aceptada.
    const currencies = currency
      ? [currency]
      : product.pricingConfig.acceptedCurrencies;
    const paymentOptions = await Promise.all(
      currencies.map(async (currency) => {
        // Buscar precio fijo primero
        const fixedPrice = product.pricingConfig.fixedPrices?.find(
          (p) => p.currency === currency,
        );

        if (fixedPrice) {
          return {
            currency,
            unitPrice: fixedPrice.amount,
            total: fixedPrice.amount * quantity,
            isFixedPrice: true,
          };
        }

        // Calcular conversión con margen
        const exchangeRate = await this.currencyService.getExchangeRate(
          product.baseCurrency,
          currency,
        );

        const marginMultiplier =
          1 + (product.pricingConfig.exchangeRateMargin || 0) / 100;
        const convertedPrice =
          product.basePrice * exchangeRate * marginMultiplier;
        const decimalPlaces = product.pricingConfig.decimalPlaces ?? 2;
        const roundedPrice = parseFloat(convertedPrice.toFixed(decimalPlaces));

        return {
          currency,
          unitPrice: roundedPrice,
          total: roundedPrice * quantity,
          isFixedPrice: false,
          exchangeRate,
        };
      }),
    );

    // Aplicar descuentos por volumen si existen
    if (product.saleRules?.bulkDiscounts) {
      const bestDiscount = product.saleRules.bulkDiscounts
        .filter((d) => quantity >= d.minQty)
        .sort((a, b) => b.minQty - a.minQty)[0];

      if (bestDiscount) {
        paymentOptions.forEach((option) => {
          if (bestDiscount.applicableCurrencies.includes(option.currency)) {
            const discountMultiplier = 1 - bestDiscount.discount / 100;
            option.total *= discountMultiplier;
            option.unitPrice *= discountMultiplier;
          }
        });
      }
    }

    return {
      basePrice: product.basePrice,
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
    //const reservationId = uuidv4(); // Generar un UUID único para esta reserva
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
      throw new Error(
        `Insufficient stock for product ${productId}. Available: ${availableStock}, Requested: ${quantity}`,
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
      throw new Error(`Error processing inventory for product ${productId}`);
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
    // 1. Validar que existan reservas previas
    const reservations = (
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

    if (!reservations || reservations.length === 0) {
      throw new Error(`No stock reservations found with ID ${reservationId}`);
    }

    const reservedQuantity = reservations.reduce(
      (sum, mov) => sum + mov.quantity,
      0,
    );

    if (reservedQuantity < quantity) {
      throw new Error(
        `Attempting to release ${quantity} but only ${reservedQuantity} were reserved`,
      );
    }

    // 2. Proceder con la liberación
    const inventory = await this.inventoryService.findByProduct(
      productId,
      cu,
      scopes,
      manager,
    );

    // Ordenar por fecha (más reciente primero)
    const sortedInventory = [...inventory].sort(
      (a, b) =>
        new Date(b.createdAt as Date).getTime() -
        new Date(a.createdAt as Date).getTime(),
    );

    let remainingQuantity = quantity;

    for (const inventoryItem of sortedInventory) {
      if (remainingQuantity <= 0) break;

      await this.inventoryMovementService.create(
        {
          inventoryId: inventoryItem.id as number,
          type: 'IN',
          quantity: remainingQuantity,
          reason,
          reservationId, // Mismo ID de reserva
          referenceId: reservations[0].referenceId, // Misma referencia
        },
        cu,
        scopes,
        manager,
      );

      remainingQuantity = 0;
    }
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
