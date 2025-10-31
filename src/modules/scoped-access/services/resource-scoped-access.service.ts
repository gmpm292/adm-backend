import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedAccessEntity } from '../entities/scoped-access.entity';
import { BaseService } from '../../../core/services/base.service';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { CreateScopedAccessInput } from '../dto/create-scoped-access.input';
import { UpdateScopedAccessInput } from '../dto/update-scoped-access.input';
import { NotFoundError } from '../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';
import { Business } from '../../company/business/entities/co_business.entity';
import { RoleGuardEntity } from '../../role-guard-resource/entities/role-guard.entity';
import { LogicalOperator } from '../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { EntityStatus } from '../../../core/enums/entity-status.enum';

@Injectable()
export class ResourceScopedAccessService extends BaseService<ScopedAccessEntity> {
  constructor(
    @InjectRepository(ScopedAccessEntity)
    private scopedAccessRepository: Repository<ScopedAccessEntity>,
  ) {
    super(scopedAccessRepository);
  }

  async create(
    createScopedAccessInput: CreateScopedAccessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity> {
    const { businessId, roleGuardId, ...rest } = createScopedAccessInput;
    const scopedAccess: ScopedAccessEntity = {
      ...rest,
      business: { id: businessId } as Business,
      roleGuard: { id: roleGuardId } as RoleGuardEntity,
    };

    return super.baseCreate({
      data: scopedAccess,
      uniqueFields: ['business', 'roleGuard'],
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
      relationsToLoad: ['business', 'roleGuard'],
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
  ): Promise<ScopedAccessEntity> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        business: true,
        roleGuard: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateScopedAccessInput: UpdateScopedAccessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity> {
    const {
      id: inputId,
      businessId,
      roleGuardId,
      ...rest
    } = updateScopedAccessInput;
    const scopedAccess = await super.baseFindOne({ id, cu, scopes, manager });

    if (!scopedAccess) {
      throw new NotFoundError('Scoped access not found');
    }

    return super.baseUpdate({
      id,
      data: {
        ...scopedAccess,
        ...rest,
        business: { id: businessId } as Business,
        roleGuard: { id: roleGuardId } as RoleGuardEntity,
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
  ): Promise<ScopedAccessEntity[]> {
    // First get scoped accesses with proper scope filtering
    const scopedAccesses = await super.baseFindByIds({
      ids,
      relationsToLoad: { business: true, roleGuard: true },
      cu,
      scopes,
      manager,
    });

    if (scopedAccesses.length === 0) {
      throw new NotFoundError('No scoped accesses found');
    }

    // Delete the scoped accesses
    return super.baseDeleteMany({
      ids: scopedAccesses.map((sa) => sa.id) as Array<number>,
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

    // First get deleted scoped accesses (using withDeleted)
    const scopedAccesses = await super.baseFindByIds({
      ids,
      relationsToLoad: { business: true, roleGuard: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    // Filter only actually deleted scoped accesses
    const deletedScopedAccesses = scopedAccesses.filter((sa) => sa.deletedAt);
    if (deletedScopedAccesses.length === 0) return 0;

    // Restore the scoped accesses
    return super.baseRestoreDeletedMany({
      ids: deletedScopedAccesses.map((sa) => sa.id) as Array<number>,
      cu,
      scopes,
      manager,
    });
  }

  // quitar async await y dejar para busquedas instantaneas.
  async findByBusinessAndRoleGuard(
    businessId: number,
    roleGuardId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity | null> {
    const result: ListSummary = await super.baseFind({
      options: {
        filters: [
          {
            logicalOperator: LogicalOperator.AND,
            filters: [
              {
                property: 'business.id',
                operator: ConditionalOperator.EQUAL,
                value: businessId.toString(),
              },
              {
                property: 'roleGuard.id',
                operator: ConditionalOperator.EQUAL,
                value: roleGuardId.toString(),
              },
            ],
          },
        ],
      },
      relationsToLoad: ['business', 'roleGuard'],
      cu,
      scopes,
      manager,
    });

    const data = result.data as Array<ScopedAccessEntity>;

    return data.length > 0 ? data[0] : null;
  }

  async updateAccessLevels(
    id: number,
    accessLevels: ScopedAccessEnum[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity> {
    const scopedAccess = await super.baseFindOne({ id, cu, scopes, manager });

    if (!scopedAccess) {
      throw new NotFoundError('Scoped access not found');
    }

    return super.baseUpdate({
      id,
      data: { ...scopedAccess, accessLevels },
      cu,
      scopes,
      manager,
    });
  }

  async updateEntityStatus(
    id: number,
    entityStatus: EntityStatus,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity> {
    const scopedAccess = await super.baseFindOne({ id, cu, scopes, manager });

    if (!scopedAccess) {
      throw new NotFoundError('Scoped access not found');
    }

    return super.baseUpdate({
      id,
      data: { ...scopedAccess, entityStatus },
      cu,
      scopes,
      manager,
    });
  }
}
