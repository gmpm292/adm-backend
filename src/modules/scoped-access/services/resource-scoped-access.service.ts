import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
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
import { ConflictError } from '../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../modules/auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';
import { Business } from '../../company/business/entities/co_business.entity';
import { RoleGuardEntity } from '../../role-guard-resource/entities/role-guard.entity';

import { EntityStatus } from '../../../core/enums/entity-status.enum';
import { RoleGuardService } from '../../role-guard-resource/services/role-guard.service';

interface ScopedAccessCacheKey {
  businessId: number;
  roleGuardId: number;
}

/** La API manda el estado como nombre (`ENABLED`); la columna guarda el número */
const toEntityStatus = (status?: string): EntityStatus | undefined =>
  status === undefined
    ? undefined
    : status === 'DISABLED'
      ? EntityStatus.DISABLED
      : EntityStatus.ENABLED;

/**
 * Niveles de acceso por empresa y operación: sustituyen el alcance con el que
 * una operación filtra los datos. Se guardan en memoria; solo cuentan los
 * activos.
 */
@Injectable()
export class ResourceScopedAccessService
  extends BaseService<ScopedAccessEntity>
  implements OnModuleInit
{
  private scopedAccessCache: Map<string, ScopedAccessEntity> = new Map();

  constructor(
    @InjectRepository(ScopedAccessEntity)
    private scopedAccessRepository: Repository<ScopedAccessEntity>,
    @Inject(RoleGuardService)
    private readonly roleGuardService: RoleGuardService,
  ) {
    super(scopedAccessRepository);
  }

  async onModuleInit() {
    await this.loadScopedAccessCache();
  }

  /**
   * Busca en caché por businessId y currentQueryOrEndpoint (síncrono)
   */
  findByBusinessAndQueryOrEndpoint(
    businessId: number,
    currentQueryOrEndpoint: string,
  ): ScopedAccessEntity | null {
    const roleGuardId = this.roleGuardService.getRoleGuard(
      currentQueryOrEndpoint,
    )?.id;
    if (!roleGuardId) {
      return null;
    }
    const cacheKey = this.generateCacheKey({ businessId, roleGuardId });
    return this.scopedAccessCache.get(cacheKey) || null;
  }

  async create(
    createScopedAccessInput: CreateScopedAccessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity> {
    const { businessId, roleGuardId, entityStatus, ...rest } =
      createScopedAccessInput;
    await this.checkUnique(businessId, roleGuardId);

    const scopedAccess: ScopedAccessEntity = {
      ...rest,
      entityStatus: toEntityStatus(entityStatus) ?? EntityStatus.ENABLED,
      business: { id: businessId } as Business,
      roleGuard: { id: roleGuardId } as RoleGuardEntity,
    };

    const created = await super.baseCreate({
      data: scopedAccess,
      cu,
      scopes,
      manager,
    });

    await this.loadScopedAccessCache();
    // Con empresa y operación completas: el cliente no debe recibirlas a medias
    return this.findOne(created.id as number, cu, scopes, manager);
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

  /** Solo cambia lo que llega: sin `businessId` o `roleGuardId` se conservan */
  async update(
    id: number,
    updateScopedAccessInput: UpdateScopedAccessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity> {
    const { businessId, roleGuardId, entityStatus, accessLevels } =
      updateScopedAccessInput;
    const current = await this.findOne(id, cu, scopes, manager);

    const newBusinessId = businessId ?? current.business?.id;
    const newRoleGuardId = roleGuardId ?? current.roleGuard?.id;
    if (
      newBusinessId !== current.business?.id ||
      newRoleGuardId !== current.roleGuard?.id
    ) {
      await this.checkUnique(newBusinessId as number, newRoleGuardId as number);
    }

    const status = toEntityStatus(entityStatus);
    await super.baseUpdate({
      id,
      data: {
        ...(accessLevels !== undefined && { accessLevels }),
        ...(status !== undefined && { entityStatus: status }),
        ...(businessId !== undefined && {
          business: { id: businessId } as Business,
        }),
        ...(roleGuardId !== undefined && {
          roleGuard: { id: roleGuardId } as RoleGuardEntity,
        }),
      },
      cu,
      scopes,
      manager,
    });

    await this.loadScopedAccessCache();
    return this.findOne(id, cu, scopes, manager);
  }

  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity[]> {
    const scopedAccesses = await super.baseFindByIds({
      ids,
      relationsToLoad: { business: true, roleGuard: true },
      cu,
      scopes,
      manager,
    });

    if (scopedAccesses.length === 0) {
      throw new NotFoundError('No se encontraron los niveles de acceso');
    }

    const result = await super.baseDeleteMany({
      ids: scopedAccesses.map((sa) => sa.id) as Array<number>,
      cu,
      scopes,
      manager,
      softRemove: true,
    });

    await this.loadScopedAccessCache();
    return result;
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const scopedAccesses = await super.baseFindByIds({
      ids,
      relationsToLoad: { business: true, roleGuard: true },
      cu,
      scopes,
      manager,
      withDeleted: true,
    });

    const deletedScopedAccesses = scopedAccesses.filter((sa) => sa.deletedAt);
    if (deletedScopedAccesses.length === 0) return 0;

    const result = await super.baseRestoreDeletedMany({
      ids: deletedScopedAccesses.map((sa) => sa.id) as Array<number>,
      cu,
      scopes,
      manager,
    });

    await this.loadScopedAccessCache();
    return result;
  }

  /**
   * Una empresa tiene un solo nivel de acceso por operación. La restricción
   * única de la base también cuenta los eliminados: entonces toca restaurarlo.
   */
  private async checkUnique(businessId: number, roleGuardId: number) {
    const existing = await this.scopedAccessRepository.findOne({
      where: { business: { id: businessId }, roleGuard: { id: roleGuardId } },
      withDeleted: true,
    });
    if (!existing) return;
    throw new ConflictError(
      existing.deletedAt
        ? 'Esa empresa ya tuvo un nivel de acceso para esta operación y está eliminado: restáuralo en lugar de crear otro'
        : 'Esa empresa ya tiene un nivel de acceso para esta operación',
    );
  }

  /**
   * Carga en memoria los niveles de acceso activos
   */
  private async loadScopedAccessCache(): Promise<void> {
    const all = await this.scopedAccessRepository.find({
      relations: { business: true, roleGuard: true },
    });

    this.scopedAccessCache.clear();
    for (const scopedAccess of all) {
      if (
        // La columna llega como texto ('1'): se compara como número
        Number(scopedAccess.entityStatus) === Number(EntityStatus.ENABLED) &&
        scopedAccess.business?.id &&
        scopedAccess.roleGuard?.id
      ) {
        const cacheKey = this.generateCacheKey({
          businessId: scopedAccess.business.id,
          roleGuardId: scopedAccess.roleGuard.id,
        });
        this.scopedAccessCache.set(cacheKey, scopedAccess);
      }
    }
  }

  /**
   * Genera clave única para el cache
   */
  private generateCacheKey(key: ScopedAccessCacheKey): string {
    return `${key.businessId}:${key.roleGuardId}`;
  }
}
