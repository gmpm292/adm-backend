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
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<UnitOfMeasure> {
    const unitOfMeasure = {
      ...createUnitOfMeasureInput,
      isActive: createUnitOfMeasureInput.isActive ?? true,
    } as UnitOfMeasure;

    return super.baseCreate({
      data: unitOfMeasure,
      uniqueFields: ['name', 'symbol'],
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
      relationsToLoad: ['business', 'office', 'department', 'team'],
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
  ): Promise<UnitOfMeasure> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        business: true,
        office: true,
        department: true,
        team: true,
        //materialCosts: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateUnitOfMeasureInput: UpdateUnitOfMeasureInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<UnitOfMeasure> {
    const { ...rest } = updateUnitOfMeasureInput;
    const unitOfMeasure = await super.baseFindOne({ id, cu, scopes, manager });
    if (!unitOfMeasure) {
      throw new NotFoundError('Unit of measure not found');
    }

    return super.baseUpdate({
      id,
      data: { ...unitOfMeasure, ...rest },
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
  ): Promise<UnitOfMeasure[]> {
    const unitsOfMeasure = await super.baseFindByIds({
      ids,
      //relationsToLoad: { materialCosts: true },
      cu,
      scopes,
      manager,
    });

    if (unitsOfMeasure.length === 0) {
      throw new NotFoundError('No units of measure found.');
    }

    // // Check if any unit is being used by material costs
    // const unitsInUse = unitsOfMeasure.filter(
    //   (unit) => unit.materialCosts && unit.materialCosts.length > 0,
    // );

    // if (unitsInUse.length > 0) {
    //   throw new Error(
    //     `Cannot delete units of measure that are in use: ${unitsInUse.map((u) => u.name).join(', ')}`,
    //   );
    // }

    return super.baseDeleteMany({
      ids: unitsOfMeasure.map((uom) => uom.id) as Array<number>,
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

    const unitsOfMeasure = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedUnits = unitsOfMeasure.filter((uom) => uom.deletedAt);
    if (deletedUnits.length === 0) return 0;

    return super.baseRestoreDeletedMany({
      ids: deletedUnits.map((uom) => uom.id) as Array<number>,
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
  ): Promise<UnitOfMeasure> {
    const unitOfMeasure = await super.baseFindOne({ id, cu, scopes, manager });
    if (!unitOfMeasure) {
      throw new NotFoundError('Unit of measure not found');
    }

    return super.baseUpdate({
      id,
      data: { ...unitOfMeasure, isActive: !unitOfMeasure.isActive },
      cu,
      scopes,
      manager,
    });
  }
}
