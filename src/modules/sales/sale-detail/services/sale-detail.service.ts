import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSaleDetailInput } from '../dto/create-sale-detail.input';
import { UpdateSaleDetailInput } from '../dto/update-sale-detail.input';
import { BaseService } from '../../../../core/services/base.service';
import { SaleDetail } from '../entities/sale-detail.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { SaleService } from '../../sale/services/sale.service';
import { ProductService } from '../../../inventory/product/services/product.service';
import { Sale } from '../../sale/entities/sale.entity';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ReserveReleaseReason } from '../../../inventory/product/enums/reserve-release-reason';
import { Worker } from '../../../payroll/worker/entities/worker.entity';
import { SaleDetailStatus } from '../enums/sale-detail-status.enum';
import { SaleStatus } from '../../sale/enums/sale-status.enum';
import { SALE_SCOPES, STOCK_SCOPES } from '../../sale/helpers/sale-scopes';
import { lineAmounts } from '../../sale/helpers/sale-payments.helper';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';

@Injectable()
export class SaleDetailService extends BaseService<SaleDetail> {
  constructor(
    @InjectRepository(SaleDetail)
    private saleDetailRepository: Repository<SaleDetail>,
    @InjectRepository(Worker)
    private workerRepository: Repository<Worker>,
    @Inject(forwardRef(() => SaleService))
    private saleService: SaleService,
    private productService: ProductService,

    protected scopedAccessService: ScopedAccessService,
  ) {
    super(saleDetailRepository);
  }

  private scopesFor(cu?: JWTPayload, scopes?: ScopedAccessEnum[]) {
    return scopes ?? this.scopedAccessService.scopesOrDefault(cu, SALE_SCOPES);
  }

  async create(
    createSaleDetailInput: CreateSaleDetailInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail> {
    if (!manager) {
      return this.saleDetailRepository.manager.transaction((txManager) =>
        this.create(createSaleDetailInput, cu, scopes, txManager),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    const { saleId, productId, quantity, publicistIds } = createSaleDetailInput;

    // La venta valida que el usuario puede verla; el producto y su stock son
    // de la misma empresa.
    const sale = await this.saleService.findOne(saleId, cu, scopes, manager);
    this.validateSaleForModification(sale);

    if (sale.details?.some((detail) => detail.product?.id === productId)) {
      throw new BadRequestError(
        'El producto ya está en la venta: cambia su cantidad',
      );
    }

    const product = await this.productService.findOne(
      productId,
      cu,
      STOCK_SCOPES,
      manager,
    );

    // Primero el precio: valida las reglas de cantidad antes de reservar.
    const productPaymentOptions =
      await this.productService.calculatePaymentOptions(
        productId,
        quantity,
        undefined,
        undefined,
        undefined,
        manager,
      );
    if (productPaymentOptions.paymentOptions.length === 0) {
      throw new BadRequestError(
        `"${product.name}" no tiene precio en ninguna moneda activa`,
      );
    }

    const reservationId = await this.productService.validateAndReserveStock(
      productId,
      quantity,
      ReserveReleaseReason.SALE_RESERVATION,
      String(saleId),
      cu,
      STOCK_SCOPES,
      manager,
    );

    const publicists = publicistIds?.length
      ? await this.findPublicistsByIds(publicistIds, manager)
      : [];

    const saleDetail: SaleDetail = {
      sale: { id: sale.id } as Sale,
      product,
      quantity,
      productSnapshot: this.snapshotOf(product),
      productPaymentOptions,
      reservationId,
      publicists,
      saleDetailStatus: SaleDetailStatus.DRAFT,
      business: sale.business,
      office: sale.office,
      department: sale.department,
      team: sale.team,
    };

    return super.baseCreate({
      data: saleDetail,
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
    // Sin orden pedido, las más recientes primero: la paginación necesita uno.
    const sorts = options?.sorts?.length
      ? options.sorts
      : [{ property: 'id', direction: SortDirection.DESC }];

    const summary = await super.baseFind({
      options: { ...(options ?? { skip: 0, take: 10 }), sorts },
      relationsToLoad: ['sale', 'product', 'publicists'],
      cu,
      scopes: this.scopesFor(cu, scopes),
      manager,
    });
    const details = summary.data as SaleDetail[];
    await this.loadPublicistUsers(details, manager);
    details.forEach((d) => this.withAmounts(d));
    return summary;
  }

  /** Completa los publicistas con su usuario, en una sola consulta. */
  private async loadPublicistUsers(
    details: SaleDetail[],
    manager?: EntityManager,
  ): Promise<void> {
    const ids = [
      ...new Set(
        details.flatMap((d) => (d.publicists ?? []).map((p) => p.id as number)),
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
    for (const detail of details) {
      detail.publicists = detail.publicists?.map((p) => byId.get(p.id) ?? p);
    }
  }

  /** Precio de la línea en la moneda de su venta (no se guarda). */
  private withAmounts(detail: SaleDetail): SaleDetail {
    return Object.assign(
      detail,
      lineAmounts(
        detail.productPaymentOptions,
        detail.sale?.totalAmountCurrency,
      ),
    );
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail> {
    const detail = await super.baseFindOne({
      id,
      relationsToLoad: {
        sale: true,
        product: true,
        publicists: true,
      },
      cu,
      scopes: this.scopesFor(cu, scopes),
      manager,
    });
    return this.withAmounts(detail);
  }

  async findBySale(
    saleId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail[]> {
    await this.saleService.findOne(saleId, cu, scopes, manager);
    const repository =
      manager?.getRepository(SaleDetail) ?? this.saleDetailRepository;
    const details = await repository.find({
      where: { sale: { id: saleId } },
      relations: ['sale', 'product', 'publicists', 'publicists.user'],
      order: { id: 'ASC' },
    });
    return details.map((detail) => this.withAmounts(detail));
  }

  async update(
    id: number,
    updateSaleDetailInput: UpdateSaleDetailInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail> {
    if (!manager) {
      return this.saleDetailRepository.manager.transaction((txManager) =>
        this.update(id, updateSaleDetailInput, cu, scopes, txManager),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    const saleDetail = await super.baseFindOne({
      id,
      relationsToLoad: { sale: true, product: true, publicists: true },
      cu,
      scopes,
      manager,
    });

    // Comprueba además que el usuario puede trabajar con esa venta.
    const sale = await this.saleService.findOne(
      saleDetail.sale.id as number,
      cu,
      scopes,
      manager,
    );
    this.validateSaleForModification(sale);

    const { saleId, productId, publicistIds } = updateSaleDetailInput;
    if (saleId && saleId !== sale.id) {
      throw new BadRequestError('Una línea no puede moverse a otra venta');
    }

    const quantity = updateSaleDetailInput.quantity ?? saleDetail.quantity;
    const currentProductId = saleDetail.product.id as number;
    const productChanged = !!productId && productId !== currentProductId;
    const quantityChanged = quantity !== saleDetail.quantity;
    const updateData: Partial<SaleDetail> = {};

    if (productChanged || quantityChanged) {
      const finalProductId = productChanged ? productId : currentProductId;

      updateData.productPaymentOptions =
        await this.productService.calculatePaymentOptions(
          finalProductId,
          quantity,
          undefined,
          undefined,
          undefined,
          manager,
        );
      updateData.quantity = quantity;

      if (productChanged) {
        const product = await this.productService.findOne(
          finalProductId,
          cu,
          STOCK_SCOPES,
          manager,
        );

        // Se suelta toda la reserva anterior y se abre una nueva.
        await this.productService.releaseStock(
          currentProductId,
          saleDetail.quantity,
          ReserveReleaseReason.SALE_CANCELLATION,
          saleDetail.reservationId,
          cu,
          STOCK_SCOPES,
          manager,
        );
        updateData.reservationId =
          await this.productService.validateAndReserveStock(
            finalProductId,
            quantity,
            ReserveReleaseReason.SALE_RESERVATION,
            String(sale.id),
            cu,
            STOCK_SCOPES,
            manager,
          );
        updateData.product = product;
        updateData.productSnapshot = this.snapshotOf(product);
      } else if (quantity > saleDetail.quantity) {
        await this.productService.validateAndReserveStock(
          currentProductId,
          quantity - saleDetail.quantity,
          ReserveReleaseReason.SALE_RESERVATION,
          String(sale.id),
          cu,
          STOCK_SCOPES,
          manager,
          saleDetail.reservationId,
        );
      } else {
        await this.productService.releaseStock(
          currentProductId,
          saleDetail.quantity - quantity,
          ReserveReleaseReason.SALE_CANCELLATION,
          saleDetail.reservationId,
          cu,
          STOCK_SCOPES,
          manager,
        );
      }
    }

    // Un arreglo vacío quita todos los publicistas.
    if (publicistIds !== undefined) {
      updateData.publicists = publicistIds.length
        ? await this.findPublicistsByIds(publicistIds, manager)
        : [];
    }

    return super.baseUpdate({
      id,
      data: { ...saleDetail, ...updateData },
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
  ): Promise<SaleDetail[]> {
    if (!manager) {
      return this.saleDetailRepository.manager.transaction((txManager) =>
        this.remove(ids, cu, scopes, txManager),
      );
    }
    scopes = this.scopesFor(cu, scopes);

    const details = await super.baseFindByIds({
      ids,
      relationsToLoad: { sale: true, product: true },
      cu,
      scopes,
      manager,
    });

    for (const saleId of new Set(details.map((d) => d.sale.id as number))) {
      await this.saleService.findOne(saleId, cu, scopes, manager);
    }

    for (const detail of details) {
      // Solo una línea en borrador tiene stock reservado que soltar.
      if (detail.saleDetailStatus === SaleDetailStatus.DRAFT) {
        await this.productService.releaseStock(
          detail.product.id as number,
          detail.quantity,
          ReserveReleaseReason.SALE_CANCELLATION,
          detail.reservationId,
          cu,
          STOCK_SCOPES,
          manager,
        );
      } else if (
        detail.saleDetailStatus === SaleDetailStatus.CONFIRMED &&
        detail.sale.saleStatus !== SaleStatus.CANCELLED
      ) {
        throw new BadRequestError(
          'No se puede eliminar una línea ya vendida: hay que devolverla',
        );
      }
    }

    return super.baseDeleteMany({
      ids: details.map((d) => d.id as number),
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
    return super.baseRestoreDeletedMany({
      ids,
      cu,
      scopes: this.scopesFor(cu, scopes),
      manager,
    });
  }

  /** Las reservas de las líneas pasan a ser salidas por venta. */
  public async confirmSaleDetails(
    saleDetails: SaleDetail[],
    cu?: JWTPayload,
    manager?: EntityManager,
  ): Promise<void> {
    const repository =
      manager?.getRepository(SaleDetail) ?? this.saleDetailRepository;

    for (const saleDetail of saleDetails) {
      if (saleDetail.saleDetailStatus !== SaleDetailStatus.DRAFT) continue;

      await this.productService.confirmSale(
        saleDetail.reservationId,
        String(saleDetail.sale?.id ?? ''),
        cu,
        STOCK_SCOPES,
        manager,
      );
      await repository.update(saleDetail.id as number, {
        isConfirmed: true,
        saleDetailStatus: SaleDetailStatus.CONFIRMED,
        ...(cu && { updatedBy: { id: cu.sub } }),
      });
    }
  }

  /** Suelta el stock reservado de las líneas en borrador y las cancela. */
  public async cancelSaleDetails(
    saleDetails: SaleDetail[],
    cu?: JWTPayload,
    manager?: EntityManager,
  ): Promise<void> {
    const repository =
      manager?.getRepository(SaleDetail) ?? this.saleDetailRepository;

    for (const saleDetail of saleDetails) {
      if (saleDetail.saleDetailStatus !== SaleDetailStatus.DRAFT) continue;

      await this.productService.releaseStock(
        saleDetail.product.id as number,
        saleDetail.quantity,
        ReserveReleaseReason.SALE_CANCELLATION,
        saleDetail.reservationId,
        cu,
        STOCK_SCOPES,
        manager,
      );
      await repository.update(saleDetail.id as number, {
        isConfirmed: false,
        saleDetailStatus: SaleDetailStatus.CANCELLED,
        ...(cu && { updatedBy: { id: cu.sub } }),
      });
    }
  }

  async refundSaleDetails(
    saleDetailIds: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    saleId: number;
    refundedDetails: SaleDetail[];
    totalRefundAmount: number;
    currency: string;
  }> {
    scopes = this.scopesFor(cu, scopes);

    // Obtener los detalles con sus relaciones
    const details = await super.baseFindByIds({
      ids: saleDetailIds,
      relationsToLoad: {
        sale: true,
        product: true,
      },
      cu,
      scopes,
      manager,
    });

    if (details.length !== new Set(saleDetailIds).size) {
      throw new NotFoundError('Alguna de las líneas a devolver no existe');
    }

    // Validar que todos pertenezcan a la misma venta
    const saleId = details[0].sale.id;
    const allSameSale = details.every((d) => d.sale.id === saleId);
    if (!allSameSale) {
      throw new BadRequestError(
        'Las líneas a devolver deben ser de la misma venta',
      );
    }

    const sale = details[0].sale;

    // Validar que la venta esté confirmada
    if (
      sale.saleStatus !== SaleStatus.CONFIRMED &&
      sale.saleStatus !== SaleStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestError('Solo se puede devolver una venta cobrada');
    }

    if (
      details.some((d) => d.saleDetailStatus !== SaleDetailStatus.CONFIRMED)
    ) {
      throw new BadRequestError(
        'Alguna de las líneas ya fue devuelta o no llegó a venderse',
      );
    }

    const refundCurrency = sale.totalAmountCurrency || 'CUP';
    const repository =
      manager?.getRepository(SaleDetail) ?? this.saleDetailRepository;
    let totalRefundAmount = 0;

    for (const detail of details) {
      totalRefundAmount +=
        detail.productPaymentOptions?.paymentOptions?.find(
          (opt) => opt.currency === refundCurrency,
        )?.total || 0;

      // Devolver stock al inventario
      await this.productService.releaseStock(
        detail.product.id as number,
        detail.quantity,
        ReserveReleaseReason.SALE_REFUND,
        detail.reservationId,
        cu,
        STOCK_SCOPES,
        manager,
      );

      await repository.update(detail.id as number, {
        saleDetailStatus: SaleDetailStatus.REFUNDED,
        ...(cu && { updatedBy: { id: cu.sub } }),
      });
      detail.saleDetailStatus = SaleDetailStatus.REFUNDED;
    }

    return {
      saleId: sale.id as number,
      refundedDetails: details,
      totalRefundAmount,
      currency: refundCurrency,
    };
  }

  private validateSaleForModification(sale: Sale): void {
    if (sale.saleStatus !== SaleStatus.DRAFT) {
      throw new BadRequestError(
        'La venta ya no está en borrador y sus productos no pueden cambiarse',
      );
    }
  }

  /** Datos del producto tal como estaban al venderlo. */
  private snapshotOf(product: SaleDetail['product']): Record<string, unknown> {
    return {
      id: product.id,
      name: product.name,
      basePrice: product.basePrice,
      baseCurrency: product.baseCurrency,
      costPrice: product.costPrice,
      costCurrency: product.costCurrency,
      pricingConfig: product.pricingConfig,
      saleRules: product.saleRules,
      warranty: product.warranty,
      attributes: product.attributes,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : undefined,
      unitOfMeasure: product.unitOfMeasure
        ? {
            id: product.unitOfMeasure.id,
            name: product.unitOfMeasure.name,
            symbol: product.unitOfMeasure.symbol,
          }
        : undefined,
    };
  }

  private async findPublicistsByIds(
    publicistIds: number[],
    manager?: EntityManager,
  ): Promise<Worker[]> {
    const ids = [...new Set(publicistIds)];
    const repository = manager?.getRepository(Worker) ?? this.workerRepository;
    const publicists = await repository.find({ where: { id: In(ids) } });

    // Validar que se encontraron todos los publicistas solicitados
    if (publicists.length !== ids.length) {
      const foundIds = publicists.map((p) => p.id);
      const missingIds = ids.filter((id) => !foundIds.includes(id));
      throw new NotFoundError(
        `Publicistas no encontrados: ${missingIds.join(', ')}`,
      );
    }

    return publicists;
  }
}
