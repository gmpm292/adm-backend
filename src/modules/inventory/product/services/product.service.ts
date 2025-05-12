import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
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

@Injectable()
export class ProductService extends BaseService<Product> {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private inventoryService: InventoryService,
    @Inject(forwardRef(() => CategoryService))
    private categoryService: CategoryService,
    protected scopedAccessService: ScopedAccessService,
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
}
