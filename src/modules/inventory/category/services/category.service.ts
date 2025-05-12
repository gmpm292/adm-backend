import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateCategoryInput } from '../dto/create-category.input';
import { UpdateCategoryInput } from '../dto/update-category.input';
import { BaseService } from '../../../../core/services/base.service';
import { Category } from '../entities/category.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { ProductService } from '../../product/services/product.service';

@Injectable()
export class CategoryService extends BaseService<Category> {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private productService: ProductService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(categoryRepository);
  }

  async create(
    createCategoryInput: CreateCategoryInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Category> {
    const category = {
      ...createCategoryInput,
    } as Category;

    return super.baseCreate({
      data: category,
      uniqueFields: ['name'],
      cu,
      scopes,
      manager,
      isSecurityBaseEntity: true,
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
      relationsToLoad: ['products'],
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
  ): Promise<Category> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        products: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateCategoryInput: UpdateCategoryInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Category> {
    const { ...rest } = updateCategoryInput;
    const category = await super.baseFindOne({ id, cu, scopes, manager });
    if (!category) {
      throw new NotFoundError();
    }

    return super.baseUpdate({
      id,
      data: { ...category, ...rest },
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
  ): Promise<Category[]> {
    const categories = await super.baseFindByIds({
      ids,
      relationsToLoad: { products: true },
      cu,
      scopes,
      manager,
    });

    if (categories.length === 0) {
      throw new NotFoundError('No categories found.');
    }

    await Promise.all(
      categories.map((category) =>
        category.products?.length
          ? this.productService.remove(
              category.products.map((p) => p.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseDeleteMany({
      ids: categories.map((c) => c.id) as Array<number>,
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

    const categories = await super.baseFindByIds({
      ids,
      relationsToLoad: { products: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedCategories = categories.filter((c) => c.deletedAt);
    if (deletedCategories.length === 0) return 0;

    await Promise.all(
      deletedCategories.map((category) =>
        category.products?.length
          ? this.productService.restore(
              category.products
                .filter((p) => p.deletedAt)
                .map((p) => p.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    return super.baseRestoreDeletedMany({
      ids: deletedCategories.map((c) => c.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
