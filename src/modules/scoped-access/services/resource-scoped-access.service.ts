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
   * Busca en caché por businessId y roleGuardId (síncrono)
   */
  findByBusinessAndRoleGuard(
    businessId: number,
    roleGuardId: number,
  ): ScopedAccessEntity | null {
    const cacheKey = this.generateCacheKey({ businessId, roleGuardId });
    return this.scopedAccessCache.get(cacheKey) || null;
  }

  /**
   * Busca en caché por businessId y currentQueryOrEndpoint (síncrono)
   */
  findByBusinessAndQueryOrEndpoint(
    businessId: number,
    currentQueryOrEndpoint: string,
  ): ScopedAccessEntity | null {
    const roleGuardId = this.getRoleGuardIdFromQueryOrEndpoint(
      currentQueryOrEndpoint,
    );
    if (!roleGuardId) {
      return null;
    }
    return this.findByBusinessAndRoleGuard(businessId, roleGuardId);
  }

  /**
   * Obtiene los access levels desde caché por businessId y roleGuardId (síncrono)
   */
  getAccessLevelsByBusinessAndRoleGuard(
    businessId: number,
    roleGuardId: number,
  ): ScopedAccessEnum[] {
    const scopedAccess = this.findByBusinessAndRoleGuard(
      businessId,
      roleGuardId,
    );
    return scopedAccess?.accessLevels || [];
  }

  /**
   * Obtiene los access levels desde caché por businessId y currentQueryOrEndpoint (síncrono)
   */
  getAccessLevelsByBusinessAndQueryOrEndpoint(
    businessId: number,
    currentQueryOrEndpoint: string,
  ): ScopedAccessEnum[] {
    const scopedAccess = this.findByBusinessAndQueryOrEndpoint(
      businessId,
      currentQueryOrEndpoint,
    );
    return scopedAccess?.accessLevels || [];
  }

  // Resto de los métodos permanecen igual...
  async create(
    createScopedAccessInput: CreateScopedAccessInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScopedAccessEntity> {
    const { businessId, roleGuardId, entityStatus, ...rest } =
      createScopedAccessInput;
    const scopedAccess: ScopedAccessEntity = {
      ...rest,
      entityStatus:
        entityStatus == 'DISABLED'
          ? EntityStatus.DISABLED
          : EntityStatus.ENABLED,
      business: { id: businessId } as Business,
      roleGuard: { id: roleGuardId } as RoleGuardEntity,
    };

    const result = await super.baseCreate({
      data: scopedAccess,
      //uniqueFields: ['business', 'roleGuard'],
      cu,
      scopes,
      manager,
    });

    await this.loadScopedAccessCache();
    return result;
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
      entityStatus,
      ...rest
    } = updateScopedAccessInput;
    const scopedAccess = await super.baseFindOne({ id, cu, scopes, manager });

    if (!scopedAccess) {
      throw new NotFoundError('Scoped access not found');
    }

    const result = await super.baseUpdate({
      id,
      data: {
        ...scopedAccess,
        ...rest,
        entityStatus:
          entityStatus == 'DISABLED'
            ? EntityStatus.DISABLED
            : EntityStatus.ENABLED,
        business: { id: businessId } as Business,
        roleGuard: { id: roleGuardId } as RoleGuardEntity,
      },
      cu,
      scopes,
      manager,
    });

    await this.loadScopedAccessCache();
    return result;
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
      throw new NotFoundError('No scoped accesses found');
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

    const result = await super.baseUpdate({
      id,
      data: { ...scopedAccess, accessLevels },
      cu,
      scopes,
      manager,
    });

    await this.loadScopedAccessCache();
    return result;
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

    const result = await super.baseUpdate({
      id,
      data: { ...scopedAccess, entityStatus },
      cu,
      scopes,
      manager,
    });

    await this.loadScopedAccessCache();
    return result;
  }

  /**
   * Carga todos los scoped access en memoria
   */
  private async loadScopedAccessCache(): Promise<void> {
    this.scopedAccessCache.clear();

    const allScopedAccess = await this.findInDB({ skip: 0 });

    if (allScopedAccess.totalCount > 0) {
      for (const scopedAccess of allScopedAccess.data as ScopedAccessEntity[]) {
        if (scopedAccess.business?.id && scopedAccess.roleGuard?.id) {
          const cacheKey = this.generateCacheKey({
            businessId: scopedAccess.business.id,
            roleGuardId: scopedAccess.roleGuard.id,
          });
          this.scopedAccessCache.set(cacheKey, scopedAccess);
        }
      }
    }

    console.log(
      `Loaded ${allScopedAccess.totalCount} scoped access entities into cache`,
    );
  }

  /**
   * Busca en la base de datos (para operaciones que requieren datos frescos)
   */
  private async findInDB(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind({
      options,
      relationsToLoad: ['business', 'roleGuard'],
    });
  }

  /**
   * Genera clave única para el cache
   */
  private generateCacheKey(key: ScopedAccessCacheKey): string {
    return `${key.businessId}:${key.roleGuardId}`;
  }

  /**
   * Obtiene el roleGuardId desde queryOrEndpoint usando RoleGuardService
   */
  private getRoleGuardIdFromQueryOrEndpoint(
    queryOrEndpoint: string,
  ): number | null {
    const roleGuard = this.roleGuardService.getRoleGuard(queryOrEndpoint);
    return roleGuard?.id || null;
  }

  /**
   * Método para forzar recarga del cache (útil para testing o sincronización)
   */
  async reloadCache(): Promise<void> {
    await this.loadScopedAccessCache();
  }

  /**
   * Obtiene estadísticas del cache (útil para monitoreo)
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.scopedAccessCache.size,
      keys: Array.from(this.scopedAccessCache.keys()),
    };
  }
}
