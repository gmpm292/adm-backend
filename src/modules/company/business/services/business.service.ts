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
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { Office } from '../../office/entities/co_office.entity';
import { User } from '../../../users/entities/user.entity';
import {
  assertNotInUse,
  assertUniqueName,
  cleanName,
  cleanText,
  plural,
} from '../../helpers/company-structure.helper';

@Injectable()
export class BusinessService extends BaseService<Business> {
  constructor(
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(businessRepository);
  }

  private managerOf(manager?: EntityManager): EntityManager {
    return manager ?? this.businessRepository.manager;
  }

  async create(
    createBusinessInput: CreateBusinessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Business> {
    const name = cleanName(createBusinessInput.name);
    await assertUniqueName(
      this.managerOf(manager),
      Business,
      name,
      {},
      `Ya existe una empresa llamada "${name}"`,
    );

    const business = {
      name,
      taxId: cleanText(createBusinessInput.taxId),
      address: cleanText(createBusinessInput.address),
      contactPhone: cleanText(createBusinessInput.contactPhone),
      contactEmail: cleanText(createBusinessInput.contactEmail)?.toLowerCase(),
    } as Business;

    return super.baseCreate({ data: business, cu, scopes, manager });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const sorts = options?.sorts?.length
      ? options.sorts
      : [{ property: 'name', direction: SortDirection.ASC }];

    return await super.baseFind({
      options: { ...(options ?? { skip: 0, take: 10 }), sorts },
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
    await super.baseFindOne({ id, cu, scopes, manager });
    const data: Partial<Business> = {};

    if (updateBusinessInput.name !== undefined) {
      data.name = cleanName(updateBusinessInput.name);
      await assertUniqueName(
        this.managerOf(manager),
        Business,
        data.name,
        {},
        `Ya existe una empresa llamada "${data.name}"`,
        id,
      );
    }
    // `null` o una cadena vacía borran el dato opcional.
    for (const field of ['taxId', 'address', 'contactPhone'] as const) {
      if (updateBusinessInput[field] !== undefined) {
        data[field] = cleanText(updateBusinessInput[field]) as string;
      }
    }
    if (updateBusinessInput.contactEmail !== undefined) {
      data.contactEmail = cleanText(
        updateBusinessInput.contactEmail,
      )?.toLowerCase() as string;
    }

    if (Object.keys(data).length > 0) {
      await super.baseUpdate({ id, data, cu, scopes, manager });
    }
    return this.findOne(id, cu, scopes, manager);
  }

  /** Solo se elimina una empresa vacía: sin oficinas ni usuarios. */
  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Business[]> {
    const businesses = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
    });

    if (businesses.length === 0) {
      throw new NotFoundError('Empresa no encontrada');
    }

    await assertNotInUse(this.managerOf(manager), businesses, [
      {
        entity: Office,
        where: (id) => ({ business: { id } }),
        label: plural('oficina', 'oficinas'),
      },
      {
        entity: User,
        where: (id) => ({ business: { id } }),
        label: plural('usuario', 'usuarios'),
      },
    ]);

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

    const businesses = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedBusinesses = businesses.filter((b) => b.deletedAt);
    if (deletedBusinesses.length === 0) return 0;

    return super.baseRestoreDeletedMany({
      ids: deletedBusinesses.map((b) => b.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }
}
