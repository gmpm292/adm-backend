import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateBusinessInput } from '../dto/create-business.input';
import { UpdateBusinessInput } from '../dto/update-business.input';
import { BaseService } from '../../../../core/services/base.service';
import { Business } from '../entities/co_business.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { OfficeService } from '../../office/services/office.service';

@Injectable()
export class BusinessService extends BaseService<Business> {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    private officeService: OfficeService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(businessRepository);
  }

  async create(
    createBusinessInput: CreateBusinessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Business> {
    const business = {
      ...createBusinessInput,
    } as Business;

    return super.baseCreate({
      data: business,
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
      relationsToLoad: ['offices'],
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
  ): Promise<Business> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        offices: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateBusinessInput: UpdateBusinessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Business> {
    const { ...rest } = updateBusinessInput;
    const business = await super.baseFindOne({ id, cu, scopes, manager });
    if (!business) {
      throw new NotFoundError();
    }

    return super.baseUpdate({
      id,
      data: { ...business, ...rest },
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
  ): Promise<Business[]> {
    // First get businesses with proper scope filtering and their offices
    const businesses = await super.baseFindByIds({
      ids,
      relationsToLoad: { offices: true },
      cu,
      scopes,
      manager,
    });

    if (businesses.length === 0) {
      throw new NotFoundError('Not businesses found.');
    }

    // Delete related offices in parallel
    await Promise.all(
      businesses.map((business) =>
        business.offices?.length
          ? this.officeService.remove(
              business.offices.map((o) => o.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    // Finally delete the businesses
    return super.baseDeleteMany({
      ids: businesses.map((b) => b.id) as Array<number>,
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

    // First get deleted businesses with offices (using withDeleted)
    const businesses = await super.baseFindByIds({
      ids,
      relationsToLoad: { offices: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    // Filter only actually deleted businesses
    const deletedBusinesses = businesses.filter((b) => b.deletedAt);
    if (deletedBusinesses.length === 0) return 0;

    // Restore related offices in parallel
    await Promise.all(
      deletedBusinesses.map((business) =>
        business.offices?.length
          ? this.officeService.restore(
              business.offices
                .filter((o) => o.deletedAt)
                .map((o) => o.id) as number[],
              cu,
              scopes,
              manager,
            )
          : Promise.resolve(),
      ),
    );

    // Finally restore the businesses
    return super.baseRestoreDeletedMany({
      ids: deletedBusinesses.map((b) => b.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
