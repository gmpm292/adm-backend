import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSaleInput } from '../dto/create-sale.input';
import { UpdateSaleInput } from '../dto/update-sale.input';
import { BaseService } from '../../../../core/services/base.service';
import { Sale } from '../entities/sale.entity';
import {
  ListFilter,
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { CustomerService } from '../../customer/services/customer.service';
import { SaleDetailService } from '../../sale-detail/services/sale-detail.service';
import { ProductService } from '../../../inventory/product/services/product.service';
import { WorkerService } from '../../../payroll/worker/services/worker.service';
import { PaymentMethod } from '../enums/payment-method.enum';
import { SaleDetail } from '../../sale-detail/entities/sale-detail.entity';
import { CurrencyService } from '../../../payroll/currency/services/currency.service';
import { Worker } from '../../../payroll/worker/entities/worker.entity';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';

@Injectable()
export class SaleService extends BaseService<Sale> {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    private workerService: WorkerService,
    private customerService: CustomerService,
    @Inject(forwardRef(() => SaleDetailService))
    private saleDetailService: SaleDetailService,
    @Inject(forwardRef(() => ProductService))
    // private readonly productService: ProductService,
    // private readonly inventoryService: InventoryService,
    // private readonly inventoryMovementService: InventoryMovementService,
    private readonly currencyService: CurrencyService,

    protected scopedAccessService: ScopedAccessService,
  ) {
    super(saleRepository);
  }

  async create(
    createSaleInput: CreateSaleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    const { customerId, details, ...rest } = createSaleInput;
    const salesWorkerId = createSaleInput.salesWorkerId ?? cu?.sub;

    const [salesWorker, customer] = await Promise.all([
      await this.workerService.findOne(salesWorkerId, cu, scopes, manager),
      customerId
        ? await this.customerService.findOne(customerId, cu, scopes, manager)
        : undefined,
    ]);

    if (!salesWorker) {
      throw new NotFoundError('Sales Worker not found');
    }

    const sale: Sale = {
      ...rest,
      salesWorker,
      customer,
    } as Sale;

    const createdSale = await super.baseCreate({
      data: sale,
      cu,
      scopes,
      manager,
    });

    // Create sale details
    await Promise.all(
      details.map((detail) =>
        this.saleDetailService.create(
          {
            saleId: createdSale.id as number,
            productId: detail.productId,
            quantity: detail.quantity,
          },
          cu,
          scopes,
          manager,
        ),
      ),
    );

    return this.findOne(createdSale.id as number, cu, scopes, manager);
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
        'salesWorker',
        'customer',
        'details',
        'details.publicists',
        'details.product',
        'product.category',
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
  ): Promise<Sale> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        salesWorker: true,
        customer: true,
        details: { product: { category: true }, publicists: true },
      },
      cu,
      scopes,
      manager,
    });
  }

  async findByCustomer(
    customerId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale[]> {
    await this.customerService.findOne(customerId, cu, scopes, manager);
    return this.saleRepository.find({
      where: { customer: { id: customerId } },
      relations: ['salesUser', 'customer', 'details'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: number,
    updateSaleInput: UpdateSaleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    const sale = await super.baseFindOne({ id, cu, scopes, manager });
    if (!sale) {
      throw new NotFoundError();
    }

    if (updateSaleInput.salesWorkerId) {
      const salesWorker = await this.workerService.findOne(
        updateSaleInput.salesWorkerId,
        cu,
        scopes,
        manager,
      );
      if (!salesWorker) {
        throw new NotFoundError('Sales user not found');
      }
      sale.salesWorker = salesWorker;
    }

    if (updateSaleInput.customerId) {
      const customer = await this.customerService.findOne(
        updateSaleInput.customerId,
        cu,
        scopes,
        manager,
      );
      sale.customer = customer;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { salesWorkerId: salesUserId, customerId, ...rest } = updateSaleInput;
    return super.baseUpdate({
      id,
      data: { ...sale, ...rest },
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
  ): Promise<Sale[]> {
    const sales = await super.baseFindByIds({
      ids,
      relationsToLoad: { details: true },
      cu,
      scopes,
      manager,
    });

    if (sales.length === 0) {
      throw new NotFoundError('No sales found.');
    }

    await Promise.all(
      sales.map((sale) =>
        sale.details?.length
          ? this.saleDetailService.remove(
              sale.details.map((d) => d.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseDeleteMany({
      ids: sales.map((s) => s.id) as Array<number>,
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

    const sales = await super.baseFindByIds({
      ids,
      relationsToLoad: { details: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedSales = sales.filter((s) => s.deletedAt);
    if (deletedSales.length === 0) return 0;

    await Promise.all(
      deletedSales.map((sale) =>
        sale.details?.length
          ? this.saleDetailService.restore(
              sale.details
                .filter((d) => d.deletedAt)
                .map((d) => d.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseRestoreDeletedMany({
      ids: deletedSales.map((s) => s.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }

  async makeSale(
    saleId: number,
    payments: Array<{
      amount: number;
      currency: string;
      paymentMethod: PaymentMethod;
      paymentDetails?: Record<string, unknown>;
    }>,
    baseCurrency: string = 'USD',
    customDate?: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    // 1. Obtener la venta con detalles
    const sale = await this.findOne(saleId, cu, scopes, manager);
    if (!sale) throw new NotFoundError('Sale not found');

    // 2. Validar que no esté ya finalizada
    if (sale.effectiveDate) throw new Error('Sale already finalized');

    // 3. Validar que la venta tenga detalles
    if (!sale.details || sale.details.length === 0) {
      throw new Error('Sale has no details');
    }

    // 4. Validar que se hayan proporcionado pagos
    if (!payments || payments.length === 0) {
      throw new Error('No payments provided');
    }

    // 5. Calcular totales requeridos por moneda y validar contra pagos
    const validationResult = await this.validateSalePayments(
      sale.details,
      payments,
      baseCurrency,
    );
    if (!validationResult.valid) {
      throw new Error(validationResult.message);
    }

    // 6. Actualizar la venta como finalizada
    const finalizedSale = await this.update(
      saleId,
      {
        id: saleId,
        payments,
        totalAmount: validationResult.totalInBaseCurrency,
        totalAmountCurrency: baseCurrency,
        effectiveDate: customDate || new Date(),
      },
      cu,
      scopes,
      manager,
    );

    return finalizedSale;
  }

  private async validateSalePayments(
    details: SaleDetail[],
    payments: Array<{ amount: number; currency: string }>,
    baseCurrency: string,
  ): Promise<{
    valid: boolean;
    message?: string;
    totalInBaseCurrency: number;
  }> {
    // 1. Agrupar opciones de pago por moneda
    const currencyOptions = new Map<
      string,
      {
        minTotal: number; // Suma de mínimos requeridos (precio más bajo por producto)
        maxTotal: number; // Suma de máximos posibles (precio más alto por producto)
        accepted: boolean; // Si todos los productos aceptan esta moneda
      }
    >();

    // 2. Procesar cada detalle para calcular totales por moneda
    for (const detail of details) {
      if (!detail.productPaymentOptions?.paymentOptions?.length) {
        return {
          valid: false,
          message: `Product ${detail.product.id} has no payment options`,
          totalInBaseCurrency: 0,
        };
      }

      // Agrupar opciones por moneda para este producto
      const productCurrencyOptions = new Map<
        string,
        {
          min: number;
          max: number;
        }
      >();

      for (const option of detail.productPaymentOptions.paymentOptions) {
        if (!productCurrencyOptions.has(option.currency)) {
          productCurrencyOptions.set(option.currency, {
            min: option.total,
            max: option.total,
          });
        } else {
          const current = productCurrencyOptions.get(option.currency) as {
            min: number;
            max: number;
          };
          // Tomar el precio más bajo para el mínimo
          if (option.total < current.min) current.min = option.total;
          // Tomar el precio más alto para el máximo
          if (option.total > current.max) current.max = option.total;
        }
      }

      // Consolidar con los totales globales
      for (const [currency, { min, max }] of productCurrencyOptions) {
        const globalOption = currencyOptions.get(currency) || {
          minTotal: 0,
          maxTotal: 0,
          accepted: true,
        };

        globalOption.minTotal += min;
        globalOption.maxTotal += max;

        // Si algún producto no acepta esta moneda, marcarla como no aceptada globalmente
        currencyOptions.set(currency, globalOption);
      }
    }

    // 3. Validar que los pagos cubran al menos una combinación válida
    const paymentByCurrency = new Map<string, number>();
    for (const payment of payments) {
      const current = paymentByCurrency.get(payment.currency) || 0;
      paymentByCurrency.set(payment.currency, current + payment.amount);
    }

    // 4. Encontrar una combinación de monedas que satisfaga los pagos
    let bestCombination: {
      currencies: string[];
      totalInBaseCurrency: number;
    } | null = null;
    let bestDifference = Infinity;

    // Generar todas las combinaciones posibles de monedas aceptadas
    const acceptedCurrencies = Array.from(currencyOptions.keys());
    const currencyCombinations =
      this.generateCurrencyCombinations(acceptedCurrencies);

    for (const combination of currencyCombinations) {
      // Verificar que los pagos cubran esta combinación
      let isValid = true;
      let totalInBase = 0;

      for (const currency of combination) {
        const paid = paymentByCurrency.get(currency) || 0;
        const requiredMin = currencyOptions.get(currency)?.minTotal as number;

        if (paid < requiredMin) {
          isValid = false;
          break;
        }

        // Convertir a moneda base
        if (currency === baseCurrency) {
          totalInBase += paid;
        } else {
          const rate = await this.currencyService.getExchangeRate(
            currency,
            baseCurrency,
          );
          if (!rate) {
            isValid = false;
            break;
          }
          totalInBase += paid * rate;
        }
      }

      // Si es válida, verificar si es la mejor opción (más cercana al total)
      if (isValid) {
        const totalMax = combination.reduce((sum, currency) => {
          return sum + (currencyOptions.get(currency)?.maxTotal as number);
        }, 0);

        const difference = Math.abs(totalInBase - totalMax);
        if (difference < bestDifference) {
          bestDifference = difference;
          bestCombination = {
            currencies: combination,
            totalInBaseCurrency: totalInBase,
          };
        }
      }
    }

    if (!bestCombination) {
      return {
        valid: false,
        message: 'Payments do not cover any valid currency combination',
        totalInBaseCurrency: 0,
      };
    }

    // 5. Verificar que no haya pagos en monedas no utilizadas
    const unusedPayments = payments.filter(
      (p) => !bestCombination.currencies.includes(p.currency),
    );

    if (unusedPayments.length > 0) {
      return {
        valid: false,
        message: `Payments include unused currencies: ${unusedPayments.map((p) => p.currency).join(', ')}`,
        totalInBaseCurrency: 0,
      };
    }

    return {
      valid: true,
      totalInBaseCurrency: bestCombination.totalInBaseCurrency,
    };
  }

  // Genera todas las combinaciones posibles de monedas
  private generateCurrencyCombinations(currencies: string[]): string[][] {
    const result: string[][] = [];

    // Función recursiva para generar combinaciones
    function backtrack(start: number, current: string[]) {
      if (current.length > 0) {
        result.push([...current]);
      }

      for (let i = start; i < currencies.length; i++) {
        current.push(currencies[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    }

    backtrack(0, []);
    return result;
  }

  async getSalesByScope(
    params: {
      businessId?: number;
      officeId?: number;
      departmentId?: number;
      teamId?: number;
      worker?: Worker;
      ownSales?: boolean;
      scope: ScopedAccessEnum;
      startDate: Date;
      endDate: Date;
      productId?: number;
      categoryId?: number;
    },
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale[]> {
    const {
      businessId,
      officeId,
      departmentId,
      teamId,
      worker,
      ownSales = false,
      scope,
      startDate,
      endDate,
      productId,
      categoryId,
    } = params;

    // Validar que el worker tenga el ID del scope requerido o se pase el ID de acuerdo al scope.
    let scopeProp: string | undefined;
    let scopeId: number | undefined;
    switch (scope) {
      case ScopedAccessEnum.BUSINESS:
        scopeProp = 'business.id';
        scopeId = worker?.business?.id || businessId;
        break;
      case ScopedAccessEnum.OFFICE:
        scopeProp = 'office.id';
        scopeId = worker?.office?.id || officeId;
        break;
      case ScopedAccessEnum.DEPARTMENT:
        scopeProp = 'department.id';
        scopeId = worker?.department?.id || departmentId;
        break;
      case ScopedAccessEnum.TEAM:
        scopeProp = 'team.id';
        scopeId = worker?.team?.id || teamId;
        break;
      default:
        scopeId = undefined;
    }
    if (!scopeId || !scopeProp) {
      throw new ConflictError(
        `Worker or requested scope does not have required scope ID for ${scope}`,
      );
    }

    const filters: ListFilter[] = [
      {
        property: 'effectiveDate',
        operator: ConditionalOperator.IS_NOT_NULL,
      } as ListFilter,
      {
        property: 'effectiveDate',
        operator: ConditionalOperator.GREATER_EQUAL_THAN,
        value: startDate.toISOString(),
      },
      {
        property: 'effectiveDate',
        operator: ConditionalOperator.LESS_EQUAL_THAN,
        value: endDate.toISOString(),
      },
      {
        property: scopeProp,
        operator: ConditionalOperator.EQUAL,
        value: String(scopeId),
      },
    ];

    // Solo filtrar por salesWorker si ownSales es true
    if (ownSales) {
      if (!worker)
        throw new ConflictError('For find ownSales, the worker is required.');
      filters.push({
        property: 'salesWorker.id',
        operator: ConditionalOperator.EQUAL,
        value: String(worker.id),
      });
    }

    // Si existe productId filtrar para este producto.
    if (productId) {
      filters.push({
        property: 'product.id',
        operator: ConditionalOperator.EQUAL,
        value: String(productId),
      });
    }

    // Si existe categoryId filtrar para este producto.
    if (categoryId) {
      filters.push({
        property: 'category.id',
        operator: ConditionalOperator.EQUAL,
        value: String(categoryId),
      });
    }

    const sales = (await this.find({ filters }, cu, scopes, manager))
      .data as Array<Sale>;

    return sales;
  }
}
