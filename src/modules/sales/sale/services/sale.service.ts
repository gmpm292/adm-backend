import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSaleInput } from '../dto/create-sale.input';
import { UpdateSaleInput } from '../dto/update-sale.input';
import { BaseService } from '../../../../core/services/base.service';
import { Sale } from '../entities/sale.entity';
import {
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
import { UsersService } from '../../../users/services/users.service';

@Injectable()
export class SaleService extends BaseService<Sale> {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    private userService: UsersService,
    private customerService: CustomerService,
    @Inject(forwardRef(() => SaleDetailService))
    private saleDetailService: SaleDetailService,
    @Inject(forwardRef(() => ProductService))
    private productService: ProductService,
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
    const { salesUserId, customerId, details, ...rest } = createSaleInput;

    const [salesUser, customer] = await Promise.all([
      this.userService.findOne(salesUserId, undefined, cu, scopes, manager),
      customerId
        ? this.customerService.findOne(customerId, cu, scopes, manager)
        : Promise.resolve(undefined),
    ]);

    if (!salesUser) {
      throw new NotFoundError('Sales user not found');
    }

    const sale: Sale = {
      ...rest,
      salesUser,
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
            unitPrice: detail.unitPrice,
            discountPercentage: detail.discountPercentage,
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
      relationsToLoad: ['salesUser', 'customer', 'details'],
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
        salesUser: true,
        customer: true,
        details: true,
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

    if (updateSaleInput.salesUserId) {
      const salesUser = await this.userService.findOne(
        updateSaleInput.salesUserId,
        undefined,
        cu,
        scopes,
        manager,
      );
      if (!salesUser) {
        throw new NotFoundError('Sales user not found');
      }
      sale.salesUser = salesUser;
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
    const { salesUserId, customerId, ...rest } = updateSaleInput;
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
}
