import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DeepPartial, EntityManager, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSaleInput } from '../dto/create-sale.input';
import { UpdateSaleInput } from '../dto/update-sale.input';
import { QuoteSaleInput } from '../dto/quote-sale.input';
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
import { PaymentMethod } from '../enums/payment-method.enum';
import { SaleDetail } from '../../sale-detail/entities/sale-detail.entity';
import { Worker } from '../../../payroll/worker/entities/worker.entity';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { SaleStatus } from '../enums/sale-status.enum';
import { SaleDetailStatus } from '../../sale-detail/enums/sale-detail-status.enum';
import { ProductService } from '../../../inventory/product/services/product.service';
import { PaymentRollbackService } from '../../../payroll/payment-processing/services/payment-rollback.service';
import {
  SALE_SCOPES,
  STOCK_SCOPES,
  canManageSales,
  isSellerOnly,
} from '../helpers/sale-scopes';
import {
  SalePaymentEvaluation,
  defaultSaleCurrency,
  errorText,
  evaluatePayments,
  lineAmounts,
  totalsByCurrency,
} from '../helpers/sale-payments.helper';

type SalePayment = {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
};

export type SaleQuote = SalePaymentEvaluation & {
  lines: Array<{
    productId: number;
    quantity: number;
    available: number;
    prices: Array<{ currency: string; unitPrice: number; total: number }>;
    error?: string;
  }>;
};

const WORKER_RELATIONS = {
  user: true,
  business: true,
  office: true,
  department: true,
  team: true,
};

@Injectable()
export class SaleService extends BaseService<Sale> {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(Worker)
    private workerRepository: Repository<Worker>,
    private customerService: CustomerService,
    @Inject(forwardRef(() => SaleDetailService))
    private saleDetailService: SaleDetailService,
    private productService: ProductService,
    private paymentRollbackService: PaymentRollbackService,

    protected scopedAccessService: ScopedAccessService,
  ) {
    super(saleRepository);
  }

  private scopesFor(cu?: JWTPayload, scopes?: ScopedAccessEnum[]) {
    return scopes ?? this.scopedAccessService.scopesOrDefault(cu, SALE_SCOPES);
  }

  /**
   * Crea la venta con sus líneas (reservando stock) y, si llegan pagos, la
   * cobra. Todo en una transacción: si algo falla no queda ni la venta ni la
   * reserva.
   */
  async create(
    createSaleInput: CreateSaleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    if (!manager) {
      return this.saleRepository.manager.transaction((txManager) =>
        this.create(createSaleInput, cu, scopes, txManager),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    const {
      customerId,
      details,
      deliveryWorkerId,
      hasDelivery,
      deliveryNotes,
      salesWorkerId,
      payments,
      baseCurrency,
      customDate,
      businessId,
      officeId,
      departmentId,
      teamId,
      invoiceNumber,
    } = createSaleInput;

    if (!details?.length) {
      throw new BadRequestError('Agrega al menos un producto a la venta');
    }

    const salesWorker = await this.resolveSalesWorker(
      salesWorkerId,
      cu,
      manager,
    );
    const customer = customerId
      ? await this.customerService.findOne(customerId, cu, scopes, manager)
      : undefined;
    const deliveryWorker = deliveryWorkerId
      ? await this.findWorker(deliveryWorkerId, cu, manager, 'Mensajero')
      : undefined;

    // Quien no tiene tienda en su sesión vende en la del vendedor.
    const sale = {
      businessId: businessId ?? salesWorker.business?.id,
      officeId: officeId ?? salesWorker.office?.id,
      departmentId: departmentId ?? undefined,
      teamId: teamId ?? undefined,
      invoiceNumber: invoiceNumber || undefined,
      salesWorker,
      customer,
      saleStatus: SaleStatus.DRAFT,
      hasDelivery: hasDelivery ?? !!deliveryWorker,
      deliveryWorker,
      deliveryNotes: deliveryNotes || undefined,
    } as unknown as DeepPartial<Sale>;

    const createdSale = await super.baseCreate({
      data: sale,
      cu,
      scopes,
      manager,
    });
    const saleId = createdSale.id as number;

    // Un producto repetido se vende en una sola línea. Una a una: comparten
    // stock y transacción.
    for (const detail of this.mergeDetails(details)) {
      await this.saleDetailService.create(
        { saleId, ...detail },
        cu,
        scopes,
        manager,
      );
    }

    if (payments?.length) {
      await this.finalize(
        saleId,
        payments,
        baseCurrency,
        customDate,
        cu,
        scopes,
        manager,
      );
    }

    return this.findOne(saleId, cu, scopes, manager);
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const filters: ListFilter[] = [...(options?.filters ?? [])];

    if (isSellerOnly(cu)) {
      const ownWorker = await this.findOwnWorker(cu, manager);
      filters.push(
        ownWorker
          ? {
              property: 'salesWorker.id',
              operator: ConditionalOperator.EQUAL,
              value: String(ownWorker.id),
            }
          : {
              property: 'createdById',
              operator: ConditionalOperator.EQUAL,
              value: String(cu?.sub),
            },
      );
    }

    // Sin orden pedido, las más recientes primero: la paginación necesita uno.
    const sorts = options?.sorts?.length
      ? options.sorts
      : [{ property: 'id', direction: SortDirection.DESC }];

    const summary = await super.baseFind({
      options: { ...(options ?? { skip: 0, take: 10 }), filters, sorts },
      // Los usuarios de vendedor y mensajero se cargan aparte: dos uniones
      // a la misma tabla chocarían en el alias.
      relationsToLoad: [
        'salesWorker',
        'deliveryWorker',
        'customer',
        'details',
        'details.publicists',
        'details.product',
        'product.category',
      ],
      cu,
      scopes: this.scopesFor(cu, scopes),
      manager,
    });
    const sales = summary.data as Sale[];
    await this.loadWorkerUsers(sales, manager);
    sales.forEach((sale) => this.withAmounts(sale));
    return summary;
  }

  /** Completa vendedor y mensajero con su usuario, en una sola consulta. */
  private async loadWorkerUsers(
    sales: Sale[],
    manager?: EntityManager,
  ): Promise<void> {
    const ids = [
      ...new Set(
        sales
          .flatMap((sale) => [sale.salesWorker?.id, sale.deliveryWorker?.id])
          .filter((id): id is number => !!id),
      ),
    ];
    if (ids.length === 0) return;

    const repository = manager?.getRepository(Worker) ?? this.workerRepository;
    const workers = await repository.find({
      where: { id: In(ids) },
      relations: { user: true },
      withDeleted: true,
    });
    const byId = new Map(workers.map((worker) => [worker.id, worker]));

    for (const sale of sales) {
      if (sale.salesWorker) {
        sale.salesWorker = byId.get(sale.salesWorker.id) ?? sale.salesWorker;
      }
      if (sale.deliveryWorker) {
        sale.deliveryWorker =
          byId.get(sale.deliveryWorker.id) ?? sale.deliveryWorker;
      }
    }
  }

  /**
   * Importes que no se guardan: el precio de cada línea en la moneda de la
   * venta y, en un borrador, el total que tendría si se cobrara ahora.
   */
  private withAmounts(sale: Sale): Sale {
    const details = sale.details ?? [];
    let currency = sale.totalAmountCurrency;

    if (sale.totalAmount == null && sale.saleStatus === SaleStatus.DRAFT) {
      const lines = details
        .filter((d) => d.saleDetailStatus === SaleDetailStatus.DRAFT)
        .map((d) => d.productPaymentOptions);
      const totals = totalsByCurrency(lines);
      currency = defaultSaleCurrency(lines, totals);
      const total = totals.find((t) => t.currency === currency)?.total;
      if (total !== undefined) {
        sale.totalAmount = total;
        sale.totalAmountCurrency = currency;
      }
    }

    for (const detail of details) {
      Object.assign(
        detail,
        lineAmounts(detail.productPaymentOptions, currency),
      );
    }
    return sale;
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    const sale = await super.baseFindOne({
      id,
      relationsToLoad: {
        salesWorker: WORKER_RELATIONS,
        deliveryWorker: WORKER_RELATIONS,
        customer: true,
        details: { product: { category: true }, publicists: true },
        business: true,
        office: true,
        department: true,
        team: true,
        createdBy: true,
      },
      cu,
      scopes: this.scopesFor(cu, scopes),
      manager,
    });

    if (
      isSellerOnly(cu) &&
      sale.salesWorker?.user?.id !== cu?.sub &&
      sale.createdBy?.id !== cu?.sub
    ) {
      throw new NotFoundError('Venta no encontrada');
    }

    sale.details?.sort((a, b) => (a.id as number) - (b.id as number));
    return this.withAmounts(sale);
  }

  async findByCustomer(
    customerId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale[]> {
    await this.customerService.findOne(customerId, cu, scopes, manager);
    const repository = manager?.getRepository(Sale) ?? this.saleRepository;
    const sales = await repository.find({
      where: { customer: { id: customerId } },
      relations: {
        salesWorker: { user: true },
        customer: true,
        details: { product: true },
        deliveryWorker: { user: true },
      },
      order: { createdAt: 'DESC' },
    });
    return sales.map((sale) => this.withAmounts(sale));
  }

  async update(
    id: number,
    updateSaleInput: UpdateSaleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    scopes = this.scopesFor(cu, scopes);
    const sale = await this.findOne(id, cu, scopes, manager);
    const isDraft = sale.saleStatus === SaleStatus.DRAFT;
    const data: DeepPartial<Sale> = {};

    const { salesWorkerId, customerId, deliveryWorkerId } = updateSaleInput;

    if (salesWorkerId && salesWorkerId !== sale.salesWorker?.id) {
      this.assertDraft(isDraft, 'el vendedor');
      data.salesWorker = await this.resolveSalesWorker(
        salesWorkerId,
        cu,
        manager,
      );
    }

    // `null` deja la venta sin cliente.
    if (
      customerId !== undefined &&
      customerId !== (sale.customer?.id ?? null)
    ) {
      this.assertDraft(isDraft, 'el cliente');
      data.customer = customerId
        ? await this.customerService.findOne(customerId, cu, scopes, manager)
        : (null as unknown as undefined);
    }

    // `null` desasigna al mensajero.
    if (deliveryWorkerId !== undefined) {
      data.deliveryWorker = deliveryWorkerId
        ? await this.findWorker(deliveryWorkerId, cu, manager, 'Mensajero')
        : (null as unknown as undefined);
    }

    if (updateSaleInput.hasDelivery !== undefined) {
      data.hasDelivery = updateSaleInput.hasDelivery;
    }
    if (updateSaleInput.deliveryNotes !== undefined) {
      data.deliveryNotes =
        updateSaleInput.deliveryNotes || (null as unknown as undefined);
    }
    if (updateSaleInput.invoiceNumber) {
      data.invoiceNumber = updateSaleInput.invoiceNumber;
    }

    // Con mensajero asignado la venta lleva mensajería.
    const deliveryWorker =
      data.deliveryWorker !== undefined
        ? data.deliveryWorker
        : sale.deliveryWorker;
    if (deliveryWorker) data.hasDelivery = true;

    if (Object.keys(data).length > 0) {
      await super.baseUpdate({ id, data, cu, scopes, manager });
    }

    return this.findOne(id, cu, scopes, manager);
  }

  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale[]> {
    if (!manager) {
      return this.saleRepository.manager.transaction((txManager) =>
        this.remove(ids, cu, scopes, txManager),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    const sales = await super.baseFindByIds({
      ids,
      relationsToLoad: { details: { product: true } },
      cu,
      scopes,
      manager,
    });

    for (const sale of sales) {
      if (
        sale.saleStatus === SaleStatus.CONFIRMED ||
        sale.saleStatus === SaleStatus.PARTIALLY_REFUNDED
      ) {
        throw new BadRequestError(
          `La venta #${sale.id} está cobrada: devuélvela antes de eliminarla`,
        );
      }

      // Un borrador todavía tiene stock reservado.
      await this.saleDetailService.cancelSaleDetails(
        sale.details ?? [],
        cu,
        manager,
      );
      if (sale.details?.length) {
        await this.saleDetailService.baseDeleteMany({
          ids: sale.details.map((d) => d.id) as number[],
          cu,
          scopes,
          manager,
          softRemove: true,
        });
      }

      // Sin reserva ya no es un borrador que pueda cobrarse.
      if (sale.saleStatus === SaleStatus.DRAFT) {
        await manager.getRepository(Sale).update(sale.id as number, {
          saleStatus: SaleStatus.CANCELLED,
        });
      }
    }

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
    scopes = this.scopesFor(cu, scopes);

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

    for (const sale of deletedSales) {
      const detailIds = (sale.details ?? [])
        .filter((d) => d.deletedAt)
        .map((d) => d.id) as number[];
      if (detailIds.length) {
        await this.saleDetailService.restore(detailIds, cu, scopes, manager);
      }
    }

    return super.baseRestoreDeletedMany({
      ids: deletedSales.map((s) => s.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }

  /** Cobra una venta en borrador. */
  async makeSale(
    saleId: number,
    payments: SalePayment[],
    baseCurrency?: string,
    customDate?: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    if (!manager) {
      return this.saleRepository.manager.transaction((txManager) =>
        this.makeSale(
          saleId,
          payments,
          baseCurrency,
          customDate,
          cu,
          scopes,
          txManager,
        ),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    await this.finalize(
      saleId,
      payments,
      baseCurrency,
      customDate,
      cu,
      scopes,
      manager,
    );
    return this.findOne(saleId, cu, scopes, manager);
  }

  private async finalize(
    saleId: number,
    payments: SalePayment[],
    baseCurrency: string | undefined,
    customDate: Date | undefined,
    cu: JWTPayload | undefined,
    scopes: ScopedAccessEnum[] | undefined,
    manager: EntityManager,
  ): Promise<void> {
    const sale = await this.findOne(saleId, cu, scopes, manager);

    if (sale.saleStatus !== SaleStatus.DRAFT) {
      throw new BadRequestError('La venta ya fue cobrada o cancelada');
    }

    const details = (sale.details ?? []).filter(
      (d) => d.saleDetailStatus === SaleDetailStatus.DRAFT,
    );
    if (details.length === 0) {
      throw new BadRequestError('La venta no tiene productos');
    }

    if (!payments || payments.length === 0) {
      throw new BadRequestError('Indica al menos un pago');
    }

    if (sale.hasDelivery && !sale.deliveryWorker) {
      throw new BadRequestError(
        'La venta lleva mensajería: asigna un mensajero antes de cobrarla',
      );
    }

    const evaluation = this.validateSalePayments(
      details,
      payments,
      baseCurrency,
    );
    if (!evaluation.valid) {
      throw new BadRequestError(evaluation.message);
    }

    await this.saleDetailService.confirmSaleDetails(
      details.map((detail) => ({ ...detail, sale })),
      cu,
      manager,
    );

    // Solo quien administra puede fechar la venta en otro día.
    const effectiveDate =
      customDate && canManageSales(cu) ? new Date(customDate) : new Date();

    await manager.getRepository(Sale).update(saleId, {
      payments,
      totalAmount: evaluation.totalInBaseCurrency,
      totalAmountCurrency: evaluation.currency,
      effectiveDate,
      saleStatus: SaleStatus.CONFIRMED,
      isConfirmed: true,
      invoiceNumber:
        sale.invoiceNumber ||
        (await this.nextInvoiceNumber(sale, effectiveDate, manager)),
      ...(cu && { updatedBy: { id: cu.sub } }),
    });
  }

  /** Lo cobrado frente al precio de las líneas. */
  validateSalePayments(
    details: SaleDetail[],
    payments: Array<{ amount: number; currency: string }>,
    baseCurrency?: string,
  ): SalePaymentEvaluation {
    const lines = details.map((detail) => detail.productPaymentOptions);
    const totals = totalsByCurrency(lines);
    return evaluatePayments(
      totals,
      payments,
      baseCurrency ?? defaultSaleCurrency(lines, totals),
    );
  }

  /**
   * Precio y disponibilidad de un carrito sin guardarlo, con el mismo
   * cálculo que usará el cobro.
   */
  async quote(input: QuoteSaleInput, cu?: JWTPayload): Promise<SaleQuote> {
    const lines: SaleQuote['lines'] = [];
    const options: Array<SaleDetail['productPaymentOptions']> = [];

    for (const detail of this.mergeDetails(input.details ?? [])) {
      const line: SaleQuote['lines'][number] = {
        productId: detail.productId,
        quantity: detail.quantity,
        available: 0,
        prices: [],
      };
      lines.push(line);

      try {
        const product = await this.productService.findOne(
          detail.productId,
          cu,
          STOCK_SCOPES,
        );
        line.available = (product.inventories ?? []).reduce(
          (sum, inventory) => sum + inventory.currentStock,
          0,
        );

        const paymentOptions =
          await this.productService.calculatePaymentOptions(
            detail.productId,
            detail.quantity,
          );
        options.push(paymentOptions);
        line.prices = paymentOptions.paymentOptions.map((option) => ({
          currency: option.currency,
          unitPrice: option.unitPrice,
          total: option.total,
        }));

        if (line.available < detail.quantity) {
          line.error =
            line.available > 0
              ? `Solo quedan ${line.available} de "${product.name}"`
              : `"${product.name}" está agotado`;
        }
      } catch (error) {
        line.error = errorText(error);
      }
    }

    const priced = options.length === lines.length;
    const totals = priced ? totalsByCurrency(options) : [];
    const evaluation = evaluatePayments(
      totals,
      input.payments ?? [],
      input.baseCurrency ?? defaultSaleCurrency(options, totals),
    );

    const lineError = lines.find((line) => line.error)?.error;
    return {
      ...evaluation,
      valid: evaluation.valid && !lineError,
      message: lineError ?? evaluation.message,
      lines,
    };
  }

  /** Anula un borrador y devuelve su stock reservado. */
  async cancelSale(
    saleId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    if (!manager) {
      return this.saleRepository.manager.transaction((txManager) =>
        this.cancelSale(saleId, cu, scopes, txManager),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    const sale = await this.findOne(saleId, cu, scopes, manager);
    if (sale.saleStatus === SaleStatus.CANCELLED) return sale;
    if (sale.saleStatus !== SaleStatus.DRAFT) {
      throw new BadRequestError(
        'Una venta cobrada no se cancela: hay que devolverla',
      );
    }

    await this.saleDetailService.cancelSaleDetails(
      sale.details ?? [],
      cu,
      manager,
    );
    await manager.getRepository(Sale).update(saleId, {
      saleStatus: SaleStatus.CANCELLED,
      isConfirmed: false,
      ...(cu && { updatedBy: { id: cu.sub } }),
    });

    return this.findOne(saleId, cu, scopes, manager);
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

  /**
   * Devuelve la venta completa (`saleId`) o algunas de sus líneas
   * (`saleDetailIds`); el stock vuelve al inventario.
   */
  async refundSale(
    input: {
      saleId?: number;
      saleDetailIds?: number[];
    },
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Sale> {
    if (!manager) {
      return this.saleRepository.manager.transaction((txManager) =>
        this.refundSale(input, cu, scopes, txManager),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    const hasDetailIds = !!input.saleDetailIds?.length;
    if (!input.saleId && !hasDetailIds) {
      throw new BadRequestError(
        'Indica la venta o las líneas que se devuelven',
      );
    }
    if (input.saleId && hasDetailIds) {
      throw new BadRequestError(
        'Indica la venta o sus líneas, no las dos cosas',
      );
    }

    let detailIds = input.saleDetailIds as number[];
    if (input.saleId) {
      const sale = await this.findOne(input.saleId, cu, scopes, manager);

      if (sale.saleStatus === SaleStatus.FULLY_REFUNDED) {
        throw new BadRequestError('La venta ya está devuelta por completo');
      }

      detailIds = (sale.details ?? [])
        .filter((d) => d.saleDetailStatus === SaleDetailStatus.CONFIRMED)
        .map((d) => d.id as number);
      if (detailIds.length === 0) {
        throw new BadRequestError('Solo se puede devolver una venta cobrada');
      }
    }

    const { saleId, totalRefundAmount } =
      await this.saleDetailService.refundSaleDetails(
        detailIds,
        cu,
        scopes,
        manager,
      );

    // Queda devuelta por completo cuando no le queda ninguna línea vendida.
    const sale = await this.findOne(saleId, cu, scopes, manager);
    const hasSoldDetails = sale.details?.some(
      (d) => d.saleDetailStatus === SaleDetailStatus.CONFIRMED,
    );

    await manager.getRepository(Sale).update(saleId, {
      saleStatus: hasSoldDetails
        ? SaleStatus.PARTIALLY_REFUNDED
        : SaleStatus.FULLY_REFUNDED,
      // Se acumula: una venta puede devolverse en varias tandas (línea a
      // línea). Las estadísticas restan esto de totalAmount para no contar
      // como ingreso lo ya devuelto.
      refundedAmount: Number(sale.refundedAmount || 0) + totalRefundAmount,
      ...(cu && { updatedBy: { id: cu.sub } }),
    });

    // Las comisiones ya pagadas por las líneas devueltas no deben quedar
    // cobradas: se reversan (o se compensan en el próximo período si ya se
    // pagaron) en la misma transacción que la devolución.
    await this.paymentRollbackService.rollbackSalePayments(
      {
        saleId,
        reason: hasSoldDetails
          ? 'Devolución parcial de venta'
          : 'Devolución total de venta',
        compensateInNextPeriod: true,
      },
      cu,
      scopes,
      manager,
    );

    return this.findOne(saleId, cu, scopes, manager);
  }

  /** Trabajador vinculado al usuario de la sesión, si lo hay. */
  async findOwnWorker(
    cu?: JWTPayload,
    manager?: EntityManager,
  ): Promise<Worker | null> {
    if (!cu) return null;
    const repository = manager?.getRepository(Worker) ?? this.workerRepository;
    return repository.findOne({
      where: { user: { id: cu.sub } },
      relations: WORKER_RELATIONS,
    });
  }

  private async findWorker(
    id: number,
    cu: JWTPayload | undefined,
    manager: EntityManager | undefined,
    label: string,
  ): Promise<Worker> {
    const repository = manager?.getRepository(Worker) ?? this.workerRepository;
    const worker = await repository.findOne({
      where: { id },
      relations: WORKER_RELATIONS,
    });

    // Nunca un trabajador de otra empresa.
    if (!worker || (cu?.businessId && worker.business?.id !== cu.businessId)) {
      throw new NotFoundError(`${label} no encontrado`);
    }
    return worker;
  }

  /**
   * Quien vende: un vendedor sin mando siempre vende a su nombre; el resto
   * puede indicar otro trabajador y, si no lo hace, es él mismo.
   */
  private async resolveSalesWorker(
    salesWorkerId: number | undefined | null,
    cu?: JWTPayload,
    manager?: EntityManager,
  ): Promise<Worker> {
    if (salesWorkerId && !isSellerOnly(cu)) {
      return this.findWorker(salesWorkerId, cu, manager, 'Vendedor');
    }

    const ownWorker = await this.findOwnWorker(cu, manager);
    if (ownWorker) return ownWorker;

    throw new BadRequestError(
      isSellerOnly(cu)
        ? 'Tu usuario no está vinculado a un trabajador: pide a un administrador que lo asocie'
        : 'Selecciona el vendedor de la venta',
    );
  }

  private assertDraft(isDraft: boolean, what: string): void {
    if (!isDraft) {
      throw new BadRequestError(
        `La venta ya no está en borrador: no se puede cambiar ${what}`,
      );
    }
  }

  private mergeDetails(
    details: Array<{
      productId: number;
      quantity: number;
      publicistIds?: number[];
    }>,
  ) {
    const merged = new Map<
      number,
      { productId: number; quantity: number; publicistIds: number[] }
    >();
    for (const detail of details) {
      const current = merged.get(detail.productId) ?? {
        productId: detail.productId,
        quantity: 0,
        publicistIds: [],
      };
      current.quantity += detail.quantity;
      current.publicistIds = [
        ...new Set([...current.publicistIds, ...(detail.publicistIds ?? [])]),
      ];
      merged.set(detail.productId, current);
    }
    return [...merged.values()];
  }

  /** Consecutivo por empresa y año: F2026-0001. */
  private async nextInvoiceNumber(
    sale: Sale,
    date: Date,
    manager: EntityManager,
  ): Promise<string> {
    const prefix = `F${date.getFullYear()}-`;
    const query = manager
      .getRepository(Sale)
      .createQueryBuilder('sale')
      .withDeleted()
      .select(
        `MAX(CAST(SUBSTRING(sale.invoiceNumber FROM ${prefix.length + 1}) AS INTEGER))`,
        'last',
      )
      .where('sale.invoiceNumber ~ :pattern', { pattern: `^${prefix}[0-9]+$` });

    if (sale.business?.id) {
      query.andWhere('sale.businessId = :businessId', {
        businessId: sale.business.id,
      });
    } else {
      query.andWhere('sale.businessId IS NULL');
    }

    const row = await query.getRawOne<{ last: number | null }>();
    const next = (Number(row?.last) || 0) + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }
}
