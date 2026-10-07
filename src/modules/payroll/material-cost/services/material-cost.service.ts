import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateMaterialCostInput } from '../dto/create-material-cost.input';
import { UpdateMaterialCostInput } from '../dto/update-material-cost.input';

import { MaterialCost } from '../entities/material-cost.entity';

import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';

import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';

import { CurrencyService } from '../../currency/services/currency.service';
import { BaseService } from '../../../../core/services/base.service';
import { UnitOfMeasureService } from '../../../inventory/unit-of-measure/services/unit-of-measure.service';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { UnitOfMeasure } from '../../../inventory/unit-of-measure/entities/unit-of-measure.entity';
import { Currency } from '../../currency/entities/currency.entity';

export type MaterialCostView = MaterialCost & { productCount: number };

/**
 * Costo de un material por unidad (oro por gramo, tela por metro...). Es de
 * cada empresa: el nombre no se repite dentro de ella.
 */
@Injectable()
export class MaterialCostService extends BaseService<MaterialCost> {
  constructor(
    @InjectRepository(MaterialCost)
    private materialCostRepository: Repository<MaterialCost>,
    private unitOfMeasureService: UnitOfMeasureService,
    private currencyService: CurrencyService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(materialCostRepository);
  }

  async create(
    createMaterialCostInput: CreateMaterialCostInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<MaterialCost> {
    const { unitOfMeasureId, currency, ...rest } = createMaterialCostInput;
    const name = rest.name.trim();
    await this.checkUniqueName(name, rest.businessId ?? cu?.businessId);
    await this.validateUnitOfMeasure(unitOfMeasureId, manager);
    const curr = await this.validateCurrency(currency, manager);

    const materialCost: MaterialCost = {
      ...rest,
      name,
      description: rest.description?.trim() || undefined,
      isActive: rest.isActive ?? true,
      unitOfMeasure: { id: unitOfMeasureId } as UnitOfMeasure,
      currency: { id: curr.id } as Currency,
    };

    const created = await super.baseCreate({
      data: materialCost,
      cu,
      scopes,
      manager,
    });
    return this.findOne(created.id as number, cu, scopes, manager);
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const result = await super.baseFind({
      options,
      relationsToLoad: ['business', 'unitOfMeasure', 'currency'],
      cu,
      scopes,
      manager,
    });
    return {
      ...result,
      data: await this.withProductCount(result.data as MaterialCost[], manager),
    };
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<MaterialCostView> {
    const materialCost = await super.baseFindOne({
      id,
      relationsToLoad: { business: true, unitOfMeasure: true, currency: true },
      cu,
      scopes,
      manager,
    });
    return (await this.withProductCount([materialCost], manager))[0];
  }

  /** La empresa no cambia; unidad y moneda sí */
  async update(
    id: number,
    updateMaterialCostInput: UpdateMaterialCostInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<MaterialCost> {
    const current = await this.findOne(id, cu, scopes, manager);
    const {
      name,
      description,
      unitOfMeasureId,
      costPrice,
      currency,
      isActive,
    } = updateMaterialCostInput;

    if (name !== undefined) {
      await this.checkUniqueName(name.trim(), current.business?.id, id);
    }
    if (unitOfMeasureId !== undefined) {
      await this.validateUnitOfMeasure(unitOfMeasureId, manager);
    }
    const curr = currency
      ? await this.validateCurrency(currency, manager)
      : undefined;

    await super.baseUpdate({
      id,
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: (description.trim() || null) as string,
        }),
        ...(costPrice !== undefined && { costPrice }),
        ...(isActive !== undefined && { isActive }),
        ...(unitOfMeasureId !== undefined && {
          unitOfMeasure: { id: unitOfMeasureId } as UnitOfMeasure,
        }),
        ...(curr && { currency: { id: curr.id } as Currency }),
      },
      cu,
      scopes,
      manager,
    });
    return this.findOne(id, cu, scopes, manager);
  }

  /** Solo los que no usa ningún producto */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<MaterialCost[]> {
    const materialCosts = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
    });
    if (materialCosts.length === 0) {
      throw new NotFoundError('No se encontraron los materiales');
    }

    const inUse = (await this.withProductCount(materialCosts, manager)).filter(
      (mc) => mc.productCount > 0,
    );
    if (inUse.length > 0) {
      throw new BadRequestError(
        `${inUse.map((mc) => mc.name).join(', ')}: lo usan productos. Desactívalo en su lugar`,
      );
    }

    return super.baseDeleteMany({
      ids: materialCosts.map((mc) => mc.id) as Array<number>,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  /** Recupera solo el material, si su nombre sigue libre en la empresa */
  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const materialCosts = await super.baseFindByIds({
      ids,
      relationsToLoad: { business: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedMaterialCosts = materialCosts.filter((mc) => mc.deletedAt);
    if (deletedMaterialCosts.length === 0) return 0;
    for (const materialCost of deletedMaterialCosts) {
      await this.checkUniqueName(
        materialCost.name,
        materialCost.business?.id,
        materialCost.id,
        false,
      );
    }

    return super.baseRestoreDeletedMany({
      ids: deletedMaterialCosts.map((mc) => mc.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }

  async toggleActive(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<MaterialCost> {
    const materialCost = await this.findOne(id, cu, scopes, manager);
    await super.baseUpdate({
      id,
      data: { isActive: !materialCost.isActive },
      cu,
      scopes,
      manager,
    });
    return this.findOne(id, cu, scopes, manager);
  }

  private async validateUnitOfMeasure(
    unitOfMeasureId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const unit = await this.unitOfMeasureService
      .findOne(unitOfMeasureId, undefined, undefined, manager)
      .catch(() => null);
    if (!unit) {
      throw new NotFoundError('No se encontró la unidad de medida');
    }
    if (!unit.isActive) {
      throw new BadRequestError(`La unidad «${unit.name}» está desactivada`);
    }
  }

  private async validateCurrency(
    currencyCode: string,
    manager?: EntityManager,
  ): Promise<Currency> {
    const currency = await this.currencyService
      .findByCode(currencyCode, undefined, undefined, manager)
      .catch(() => null);
    if (!currency) {
      throw new NotFoundError(`No existe la moneda ${currencyCode}`);
    }
    if (!currency.isActive) {
      throw new BadRequestError(`La moneda ${currency.code} está desactivada`);
    }
    return currency;
  }

  private async checkUniqueName(
    name: string,
    businessId?: number,
    exceptId?: number,
    includeDeleted = true,
  ) {
    const query = this.materialCostRepository
      .createQueryBuilder('m')
      .where('lower(m.name) = lower(:name)', { name })
      .andWhere(
        businessId ? 'm.businessId = :businessId' : 'm.businessId IS NULL',
        { businessId },
      );
    if (exceptId) query.andWhere('m.id <> :exceptId', { exceptId });
    if (includeDeleted) query.withDeleted();
    const existing = await query.getOne();
    if (!existing) return;
    throw new ConflictError(
      existing.deletedAt
        ? `Hay un material eliminado llamado «${existing.name}»: restáuralo`
        : `Ya existe el material «${existing.name}»`,
    );
  }

  private async withProductCount(
    materialCosts: MaterialCost[],
    manager?: EntityManager,
  ): Promise<MaterialCostView[]> {
    if (!materialCosts.length) return [];
    const counts = await (manager ?? this.materialCostRepository.manager).query<
      Array<{ materialCostId: number; count: string }>
    >(
      `SELECT "materialCostId", count(*) AS count FROM in_products
       WHERE "deletedAt" IS NULL AND "materialCostId" = ANY($1)
       GROUP BY "materialCostId"`,
      [materialCosts.map((mc) => mc.id)],
    );
    return materialCosts.map((mc) => ({
      ...mc,
      productCount: Number(
        counts.find((row) => row.materialCostId === mc.id)?.count ?? 0,
      ),
    }));
  }
}
