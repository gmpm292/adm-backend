import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUnitOfMeasureInput } from '../dto/create-unit-of-measure.input';
import { UpdateUnitOfMeasureInput } from '../dto/update-unit-of-measure.input';
import { UnitOfMeasure } from '../entities/unit-of-measure.entity';

import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';

import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { BaseService } from '../../../../core/services/base.service';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';

// Catálogo común a todas las empresas: siempre en alcance general
const GLOBAL = [ScopedAccessEnum.GENERAL];

/**
 * Unidades de medida. Nombre y símbolo son únicos en todo el sistema (también
 * entre las eliminadas), por eso las unidades no pertenecen a una empresa.
 */
@Injectable()
export class UnitOfMeasureService extends BaseService<UnitOfMeasure> {
  constructor(
    @InjectRepository(UnitOfMeasure)
    private unitOfMeasureRepository: Repository<UnitOfMeasure>,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(unitOfMeasureRepository);
  }

  async create(
    createUnitOfMeasureInput: CreateUnitOfMeasureInput,
    cu?: JWTPayload,
    _scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<UnitOfMeasure> {
    const { name, symbol, category, description, isActive } =
      createUnitOfMeasureInput;
    const data = {
      name: name.trim(),
      symbol: symbol.trim(),
      category: category || undefined,
      description: description?.trim() || undefined,
      isActive: isActive ?? true,
    };
    await this.checkUnique(data);

    return super.baseCreate({ data, cu, scopes: GLOBAL, manager });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    _scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({ options, cu, scopes: GLOBAL, manager });
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    _scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<UnitOfMeasure> {
    return super.baseFindOne({ id, cu, scopes: GLOBAL, manager });
  }

  async update(
    id: number,
    updateUnitOfMeasureInput: UpdateUnitOfMeasureInput,
    cu?: JWTPayload,
    _scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<UnitOfMeasure> {
    await this.findOne(id, cu, GLOBAL, manager);
    const { name, symbol, category, description, isActive } =
      updateUnitOfMeasureInput;
    const data = {
      // Una cadena vacía borra la categoría o la descripción
      ...(name !== undefined && { name: name.trim() }),
      ...(symbol !== undefined && { symbol: symbol.trim() }),
      ...(category !== undefined && { category: (category || null) as string }),
      ...(description !== undefined && {
        description: (description.trim() || null) as string,
      }),
      ...(isActive !== undefined && { isActive }),
    };
    await this.checkUnique(data, id);

    return super.baseUpdate({ id, data, cu, scopes: GLOBAL, manager });
  }

  /** Solo las que no usa ningún producto ni costo de material */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    _scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<UnitOfMeasure[]> {
    const units = await super.baseFindByIds({
      ids,
      cu,
      scopes: GLOBAL,
      manager,
    });
    if (units.length === 0) {
      throw new NotFoundError('No se encontraron las unidades');
    }

    const repository = manager ?? this.unitOfMeasureRepository.manager;
    const inUse = await repository.query<Array<{ name: string }>>(
      `SELECT u.name FROM in_units_of_measure u
       WHERE u.id = ANY($1) AND (
         EXISTS (SELECT 1 FROM in_products p
                 WHERE p."unitOfMeasureId" = u.id AND p."deletedAt" IS NULL)
         OR EXISTS (SELECT 1 FROM material_costs m
                    WHERE m."unitOfMeasureId" = u.id AND m."deletedAt" IS NULL))`,
      [units.map((u) => u.id)],
    );
    if (inUse.length) {
      throw new BadRequestError(
        `${inUse.map((u) => u.name).join(', ')}: la usan productos o costos de materiales. Desactívala en su lugar`,
      );
    }

    return super.baseDeleteMany({
      ids: units.map((uom) => uom.id) as Array<number>,
      cu,
      scopes: GLOBAL,
      manager,
      softRemove: true,
    });
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    _scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const unitsOfMeasure = await super.baseFindByIds({
      ids,
      cu,
      scopes: GLOBAL,
      manager,
      withDeleted: true,
    });

    const deletedUnits = unitsOfMeasure.filter((uom) => uom.deletedAt);
    if (deletedUnits.length === 0) return 0;

    return super.baseRestoreDeletedMany({
      ids: deletedUnits.map((uom) => uom.id) as Array<number>,
      cu,
      scopes: GLOBAL,
      manager,
    });
  }

  async toggleActive(
    id: number,
    cu?: JWTPayload,
    _scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<UnitOfMeasure> {
    const unit = await this.findOne(id, cu, GLOBAL, manager);
    return super.baseUpdate({
      id,
      data: { isActive: !unit.isActive },
      cu,
      scopes: GLOBAL,
      manager,
    });
  }

  /** La base no admite repetir nombre ni símbolo, aunque la otra esté eliminada */
  private async checkUnique(
    data: { name?: string; symbol?: string },
    exceptId?: number,
  ) {
    for (const field of ['name', 'symbol'] as const) {
      const value = data[field];
      if (!value) continue;
      const existing = await this.unitOfMeasureRepository
        .createQueryBuilder('u')
        .withDeleted()
        // El símbolo distingue mayúsculas (m y M son unidades distintas)
        .where(
          field === 'name'
            ? 'lower(u.name) = lower(:value)'
            : 'u.symbol = :value',
          { value },
        )
        .andWhere(exceptId ? 'u.id <> :exceptId' : '1=1', { exceptId })
        .getOne();
      if (existing) {
        const what = field === 'name' ? 'ese nombre' : 'ese símbolo';
        throw new ConflictError(
          existing.deletedAt
            ? `Ya hay una unidad eliminada con ${what} (${existing.name}): restáurala`
            : `Ya existe una unidad con ${what}: ${existing.name}`,
        );
      }
    }
  }
}
