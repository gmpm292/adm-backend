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
import { ProductService } from '../../../inventory/product/services/product.service';
import { UnitOfMeasureService } from '../../../inventory/unit-of-measure/services/unit-of-measure.service';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { UnitOfMeasure } from '../../../inventory/unit-of-measure/entities/unit-of-measure.entity';
import { Currency } from '../../currency/entities/currency.entity';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { SystemUtilsService } from '../../../../core/services/system-utils.service';
import { Role } from '../../../../core/enums/role.enum';
import { Business } from '../../../company/business/entities/co_business.entity';

@Injectable()
export class MaterialCostService extends BaseService<MaterialCost> {
  constructor(
    @InjectRepository(MaterialCost)
    private materialCostRepository: Repository<MaterialCost>,
    private productService: ProductService,
    private unitOfMeasureService: UnitOfMeasureService,
    private currencyService: CurrencyService,
    protected scopedAccessService: ScopedAccessService,
    private readonly utils: SystemUtilsService,
  ) {
    super(materialCostRepository);
  }

  async create(
    createMaterialCostInput: CreateMaterialCostInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<MaterialCost> {
    const { unitOfMeasureId, currencyId, ...rest } = createMaterialCostInput;

    // Validate that unitOfMeasure exists
    await this.validateUnitOfMeasure(
      createMaterialCostInput.unitOfMeasureId,
      manager,
    );

    // Validate that currency exists
    await this.validateCurrency(createMaterialCostInput.currencyId, manager);

    const materialCost: MaterialCost = {
      ...rest,
      isActive: createMaterialCostInput.isActive ?? true,
      unitOfMeasure: { id: unitOfMeasureId } as UnitOfMeasure,
      currency: { id: currencyId } as Currency,
    };

    return super.baseCreate({
      data: materialCost,
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
    const relationsToLoad = [
      'products',
      'business',
      'office',
      'department',
      'team',
      'unitOfMeasure',
      'currency',
    ];

    return await super.baseFind({
      options,
      relationsToLoad,
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
  ): Promise<MaterialCost> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        products: true,
        business: true,
        office: true,
        department: true,
        team: true,
        unitOfMeasure: true,
        currency: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateMaterialCostInput: UpdateMaterialCostInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<MaterialCost> {
    const materialCost = await super.baseFindOne({ id, cu, scopes, manager });
    if (!materialCost) {
      throw new NotFoundError('Material cost not found');
    }

    // Validate unitOfMeasure if it's being updated
    if (updateMaterialCostInput.unitOfMeasureId) {
      await this.validateUnitOfMeasure(
        updateMaterialCostInput.unitOfMeasureId,
        manager,
      );
    }

    // Validate currency if it's being updated
    if (updateMaterialCostInput.currencyId) {
      await this.validateCurrency(updateMaterialCostInput.currencyId, manager);
    }

    const { ...rest } = updateMaterialCostInput;

    return super.baseUpdate({
      id,
      data: { ...materialCost, ...rest },
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
  ): Promise<MaterialCost[]> {
    const materialCosts = await super.baseFindByIds({
      ids,
      relationsToLoad: { products: true },
      cu,
      scopes,
      manager,
    });

    if (materialCosts.length === 0) {
      throw new NotFoundError('No material costs found.');
    }

    // Check if any material cost is being used by products
    const materialCostsInUse = materialCosts.filter(
      (mc) => mc.products && mc.products.length > 0,
    );

    if (materialCostsInUse.length > 0) {
      throw new Error(
        `Cannot delete material costs that are in use by products: ${materialCostsInUse.map((mc) => mc.name).join(', ')}`,
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

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const materialCosts = await super.baseFindByIds({
      ids,
      relationsToLoad: { products: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedMaterialCosts = materialCosts.filter((mc) => mc.deletedAt);
    if (deletedMaterialCosts.length === 0) return 0;

    // Restore associated products if they were deleted with the material cost
    await Promise.all(
      deletedMaterialCosts.map((materialCost) =>
        materialCost.products?.length
          ? this.productService.restore(
              materialCost.products
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
    const materialCost = await super.baseFindOne({ id, cu, scopes, manager });
    if (!materialCost) {
      throw new NotFoundError('Material cost not found');
    }

    return super.baseUpdate({
      id,
      data: { ...materialCost, isActive: !materialCost.isActive },
      cu,
      scopes,
      manager,
    });
  }

  async findByUnitOfMeasure(
    unitOfMeasureId: number,
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const findOptions: ListOptions = {
      ...options,
      filters: [
        ...(options?.filters || []),
        {
          property: 'unitOfMeasureId',
          operator: ConditionalOperator.EQUAL,
          value: String(unitOfMeasureId),
        },
      ],
    };

    return await this.find(findOptions, cu, scopes, manager);
  }

  async findByCurrency(
    currencyId: number,
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const findOptions: ListOptions = {
      ...options,
      filters: [
        ...(options?.filters || []),
        {
          property: 'currencyId',
          operator: ConditionalOperator.EQUAL,
          value: String(currencyId),
        },
      ],
    };

    return await this.find(findOptions, cu, scopes, manager);
  }

  private async validateUnitOfMeasure(
    unitOfMeasureId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const systemUser = this.utils.getSystemUser();
    const unitOfMeasure = await this.unitOfMeasureService.findOne(
      unitOfMeasureId,
      { sub: systemUser.id as number, role: systemUser.role as Array<Role> },
      [],
      manager,
    );

    if (!unitOfMeasure) {
      throw new NotFoundError(
        `Unit of measure with ID ${unitOfMeasureId} not found`,
      );
    }

    if (!unitOfMeasure.isActive) {
      throw new Error(`Unit of measure "${unitOfMeasure.name}" is not active`);
    }
  }

  private async validateCurrency(
    currencyId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const systemUser = this.utils.getSystemUser();
    const currency = await this.currencyService.findOne(
      currencyId,
      { sub: systemUser.id as number, role: systemUser.role as Array<Role> },
      [],
      manager,
    );

    if (!currency) {
      throw new NotFoundError(`Currency with ID ${currencyId} not found`);
    }

    if (!currency.isActive) {
      throw new Error(`Currency "${currency.code}" is not active`);
    }
  }
}
