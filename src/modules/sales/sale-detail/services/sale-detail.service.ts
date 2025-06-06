import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
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
import { InventoryService } from '../../../inventory/inventory/services/inventory.service';
import { InventoryMovementService } from '../../../inventory/inventory-movement/services/inventory-movement.service';
import { ReserveReleaseReason } from '../../../inventory/product/enums/reserve-release-reason';

@Injectable()
export class SaleDetailService extends BaseService<SaleDetail> {
  constructor(
    @InjectRepository(SaleDetail)
    private saleDetailRepository: Repository<SaleDetail>,
    @Inject(forwardRef(() => SaleService))
    private saleService: SaleService,
    private productService: ProductService,
    // private inventoryService: InventoryService,
    // private inventoryMovementService: InventoryMovementService,

    protected scopedAccessService: ScopedAccessService,
  ) {
    super(saleDetailRepository);
  }

  async create(
    createSaleDetailInput: CreateSaleDetailInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail> {
    const { saleId, productId, quantity, ...rest } = createSaleDetailInput;

    // Obtener la venta y producto
    const [sale, product] = await Promise.all([
      this.saleService.findOne(saleId, cu, scopes, manager),
      this.productService.findOne(productId, cu, scopes, manager),
    ]);

    // Validar si la venta permite modificaciones
    this.validateSaleForModification(sale);

    // Validar stock disponible y hacer reserva.
    const reservationId = await this.productService.validateAndReserveStock(
      productId,
      quantity,
      ReserveReleaseReason.SALE_RESERVATION,
      String(saleId),
      cu,
      scopes,
      manager,
    );

    const productPaymentOptions =
      await this.productService.calculatePaymentOptions(
        product.id as number,
        quantity,
      );

    // Calcular opciones de pago para el producto
    const saleDetail: SaleDetail = {
      ...rest,
      sale,
      product,
      quantity,
      productSnapshot: { ...product },
      productPaymentOptions,
      reservationId,
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
    return await super.baseFind({
      options,
      relationsToLoad: ['sale', 'product'],
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
  ): Promise<SaleDetail> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        sale: true,
        product: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findBySale(
    saleId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail[]> {
    await this.saleService.findOne(saleId, cu, scopes, manager);
    return this.saleDetailRepository.find({
      where: { sale: { id: saleId } },
      relations: ['sale', 'product'],
    });
  }

  async update(
    id: number,
    updateSaleDetailInput: UpdateSaleDetailInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail> {
    const saleDetail = await super.baseFindOne({
      id,
      relationsToLoad: { sale: true, product: true },
      cu,
      scopes,
      manager,
    });

    if (!saleDetail) {
      throw new NotFoundError('Sale detail not found');
    }

    this.validateSaleForModification(saleDetail.sale);

    // Preparar datos para actualización
    const {
      saleId,
      productId,
      quantity,
      id: saleDetailId,
    } = updateSaleDetailInput;
    const updateData: Partial<SaleDetail> = { id: saleDetailId };

    // Actualizar relación con Sale si es necesario
    if (saleId && saleId !== saleDetail.sale.id) {
      const sale = await this.saleService.findOne(saleId, cu, scopes, manager);
      if (!sale) {
        throw new NotFoundError('Sale not found');
      }
      updateData.sale = sale;
      this.validateSaleForModification(sale);
    }

    // Manejar cambio de producto
    if (productId && productId !== saleDetail.product.id) {
      const product = await this.productService.findOne(
        productId,
        cu,
        scopes,
        manager,
      );
      if (!product) {
        throw new NotFoundError('Product not found');
      }

      // Liberar stock del producto anterior
      await this.productService.releaseStock(
        saleDetail.product.id as number,
        saleDetail.quantity,
        ReserveReleaseReason.SALE_CANCELLATION,
        saleDetail.reservationId,
        cu,
        scopes,
        manager,
      );

      // Reservar stock del nuevo producto
      const reservationId = await this.productService.validateAndReserveStock(
        productId,
        quantity ?? saleDetail.quantity,
        ReserveReleaseReason.SALE_RESERVATION,
        String(saleId),
        cu,
        scopes,
        manager,
      );

      updateData.product = product;
      updateData.productSnapshot = { ...product };
      updateData.reservationId = reservationId;
    }

    // Manejar cambio de cantidad
    if (quantity !== undefined && quantity !== saleDetail.quantity) {
      // Ajustar stock según la diferencia
      const quantityDifference = quantity - saleDetail.quantity;
      if (quantityDifference > 0) {
        // Necesitamos más stock
        await this.productService.validateAndReserveStock(
          saleDetail.product.id as number,
          quantityDifference,
          ReserveReleaseReason.SALE_RESERVATION,
          String(saleId),
          cu,
          scopes,
          manager,
          saleDetail.reservationId,
        );
      } else if (quantityDifference < 0) {
        // Liberar stock sobrante
        await this.productService.releaseStock(
          saleDetail.product.id as number,
          Math.abs(quantityDifference),
          ReserveReleaseReason.DELIVERY_CANCELLATION,
          saleDetail.reservationId,
          cu,
          scopes,
          manager,
        );
      }
    }

    // Recalcular opciones de pago si cambió producto o cantidad
    if (productId || quantity !== undefined) {
      const finalProductId = productId ?? saleDetail.product.id;
      const finalQuantity = quantity ?? saleDetail.quantity;

      updateData.productPaymentOptions =
        await this.productService.calculatePaymentOptions(
          finalProductId as number,
          finalQuantity,
        );
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
    const details = await super.baseFindByIds({
      ids,
      relationsToLoad: { sale: true, product: true },
      cu,
      scopes,
      manager,
    });

    // Liberar stock de todos los detalles eliminados
    await Promise.all(
      details.map((detail) =>
        this.productService.releaseStock(
          detail.product.id as number,
          detail.quantity,
          ReserveReleaseReason.SALE_CANCELLATION,
          detail.reservationId,
          cu,
          scopes,
          manager,
        ),
      ),
    );

    return super.baseDeleteMany({
      ids,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  async remove2(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<SaleDetail[]> {
    return super.baseDeleteMany({
      ids,
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
      scopes,
      manager,
    });
  }

  private validateSaleForModification(sale: Sale): void {
    // Validar si la venta ya fue finalizada (tiene effectiveDate y es una fecha pasada)
    if (sale.effectiveDate && new Date(sale.effectiveDate) <= new Date()) {
      throw new BadRequestError(
        'Cannot modify a sale that has already been finalized',
      );
    }
  }
}
