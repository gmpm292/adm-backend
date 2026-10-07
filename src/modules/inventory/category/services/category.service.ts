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
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';

export type CategoryView = Category & { productCount: number };

/**
 * Categorías de producto de cada empresa. El nombre no se repite dentro de la
 * empresa; una categoría con productos o reglas de pago no se elimina.
 */
@Injectable()
export class CategoryService extends BaseService<Category> {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
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
    const data = {
      ...createCategoryInput,
      name: createCategoryInput.name.trim(),
      description: createCategoryInput.description?.trim() || undefined,
    } as Category;
    // La empresa sale del usuario (o del formulario, si es SUPER)
    const businessId = createCategoryInput.businessId ?? cu?.businessId;
    await this.checkUniqueName(data.name, businessId);

    return super.baseCreate({ data, cu, scopes, manager });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const result = await super.baseFind({
      options,
      relationsToLoad: ['business'],
      cu,
      scopes,
      manager,
    });
    return {
      ...result,
      data: await this.withProductCount(result.data as Category[], manager),
    };
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Category> {
    return super.baseFindOne({
      id,
      relationsToLoad: { business: true },
      cu,
      scopes,
      manager,
    });
  }

  /** Para la API: con el número de productos */
  async findOneView(id: number, cu?: JWTPayload): Promise<CategoryView> {
    return (await this.withProductCount([await this.findOne(id, cu)]))[0];
  }

  /** Nombre y descripción: la empresa de una categoría no cambia */
  async update(
    id: number,
    updateCategoryInput: UpdateCategoryInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Category> {
    const category = await this.findOne(id, cu, scopes, manager);
    const { name, description } = updateCategoryInput;
    if (name !== undefined) {
      await this.checkUniqueName(name.trim(), category.business?.id, id);
    }

    return super.baseUpdate({
      id,
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: (description.trim() || null) as string,
        }),
      },
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
      cu,
      scopes,
      manager,
    });
    if (categories.length === 0) {
      throw new NotFoundError('No se encontraron las categorías');
    }

    const inUse = await (manager ?? this.categoryRepository.manager).query<
      Array<{ name: string }>
    >(
      `SELECT c.name FROM in_categories c
       WHERE c.id = ANY($1) AND (
         EXISTS (SELECT 1 FROM in_products p
                 WHERE p."categoryId" = c.id AND p."deletedAt" IS NULL)
         OR EXISTS (SELECT 1 FROM py_payment_rules r
                    WHERE r."categoryId" = c.id AND r."deletedAt" IS NULL))`,
      [categories.map((c) => c.id)],
    );
    if (inUse.length) {
      throw new BadRequestError(
        `${inUse.map((c) => c.name).join(', ')}: tiene productos o reglas de pago. Pásalos a otra categoría antes de eliminarla`,
      );
    }

    return super.baseDeleteMany({
      ids: categories.map((c) => c.id) as Array<number>,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  /** Recupera solo la categoría, si su nombre sigue libre en la empresa */
  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const categories = await super.baseFindByIds({
      ids,
      relationsToLoad: { business: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedCategories = categories.filter((c) => c.deletedAt);
    if (deletedCategories.length === 0) return 0;
    for (const category of deletedCategories) {
      await this.checkUniqueName(
        category.name,
        category.business?.id,
        category.id,
        false,
      );
    }

    return super.baseRestoreDeletedMany({
      ids: deletedCategories.map((c) => c.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }

  private async checkUniqueName(
    name: string,
    businessId?: number,
    exceptId?: number,
    includeDeleted = true,
  ) {
    const query = this.categoryRepository
      .createQueryBuilder('c')
      .where('lower(c.name) = lower(:name)', { name })
      .andWhere(
        businessId ? 'c.businessId = :businessId' : 'c.businessId IS NULL',
        { businessId },
      );
    if (exceptId) query.andWhere('c.id <> :exceptId', { exceptId });
    if (includeDeleted) query.withDeleted();
    const existing = await query.getOne();
    if (!existing) return;
    throw new ConflictError(
      existing.deletedAt
        ? `Hay una categoría eliminada llamada «${existing.name}»: restáurala`
        : `Ya existe la categoría «${existing.name}»`,
    );
  }

  private async withProductCount(
    categories: Category[],
    manager?: EntityManager,
  ): Promise<CategoryView[]> {
    if (!categories.length) return [];
    const counts = await (manager ?? this.categoryRepository.manager).query<
      Array<{ categoryId: number; count: string }>
    >(
      `SELECT "categoryId", count(*) AS count FROM in_products
       WHERE "deletedAt" IS NULL AND "categoryId" = ANY($1)
       GROUP BY "categoryId"`,
      [categories.map((c) => c.id)],
    );
    return categories.map((c) => ({
      ...c,
      productCount: Number(
        counts.find((row) => row.categoryId === c.id)?.count ?? 0,
      ),
    }));
  }
}
