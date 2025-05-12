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

@Injectable()
export class SaleDetailService extends BaseService<SaleDetail> {
  constructor(
    @InjectRepository(SaleDetail)
    private saleDetailRepository: Repository<SaleDetail>,
    @Inject(forwardRef(() => SaleService))
    private saleService: SaleService,
    private productService: ProductService,
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
    const [sale, product] = await Promise.all([
      this.saleService.findOne(
        createSaleDetailInput.saleId,
        cu,
        scopes,
        manager,
      ),
      this.productService.findOne(
        createSaleDetailInput.productId,
        cu,
        scopes,
        manager,
      ),
    ]);

    if (!sale) {
      throw new NotFoundError('Sale not found');
    }
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const subtotal = this.calculateSubtotal(
      createSaleDetailInput.quantity,
      createSaleDetailInput.unitPrice,
      createSaleDetailInput.discountPercentage,
    );

    const saleDetail: SaleDetail = {
      ...createSaleDetailInput,
      sale,
      product,
      subtotal,
      productSnapshot: {
        id: product.id,
        name: product.name,
        attributes: product.attributes,
      },
    } as SaleDetail;

    return super.baseCreate({
      data: saleDetail,
      cu,
      scopes,
      manager,
    });
  }

  private calculateSubtotal(
    quantity: number,
    unitPrice: number,
    discountPercentage = 0,
  ): number {
    const discountMultiplier = 1 - discountPercentage / 100;
    return quantity * unitPrice * discountMultiplier;
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
    const saleDetail = await super.baseFindOne({ id, cu, scopes, manager });
    if (!saleDetail) {
      throw new NotFoundError();
    }

    if (updateSaleDetailInput.saleId) {
      const sale = await this.saleService.findOne(
        updateSaleDetailInput.saleId,
        cu,
        scopes,
        manager,
      );
      if (!sale) {
        throw new NotFoundError('Sale not found');
      }
      saleDetail.sale = sale;
    }

    if (updateSaleDetailInput.productId) {
      const product = await this.productService.findOne(
        updateSaleDetailInput.productId,
        cu,
        scopes,
        manager,
      );
      if (!product) {
        throw new NotFoundError('Product not found');
      }
      saleDetail.product = product;
      saleDetail.productSnapshot = {
        id: product.id,
        name: product.name,
        attributes: product.attributes,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { saleId, productId, ...rest } = updateSaleDetailInput;
    saleDetail.subtotal = this.calculateSubtotal(
      rest.quantity ?? saleDetail.quantity,
      rest.unitPrice ?? saleDetail.unitPrice,
      rest.discountPercentage ?? saleDetail.discountPercentage,
    );

    return super.baseUpdate({
      id,
      data: { ...saleDetail, ...rest },
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
}
