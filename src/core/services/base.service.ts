import {
  DeepPartial,
  EntityManager,
  FindOneOptions,
  FindOptionsRelations,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';

import {
  ListOptions,
  ListOptionsTypeOrmQueryBuilderMapper,
  ListSummary,
} from '../graphql/remote-operations';

import { ConditionalOperator } from '../graphql/remote-operations/enums/conditional-operation.enum';

import { BaseEntity } from '../entities/base.entity';
import { NotFoundError } from '../errors/appErrors/NotFoundError.error';
import { ConflictError } from '../errors/appErrors/ConflictError.error';
import { InternalServerError } from '../errors/appErrors/InternalServerError.error';
import { LoggerService } from '../../common/logger';
import { SecurityBaseEntity } from '../entities/security-base.entity';
import { ScopedAccessEnum } from '../enums/scoped-access.enum';
import { JWTPayload } from '../../modules/auth/dto/jwt-payload.dto';
import { Role } from '../enums/role.enum';
import { ForbiddenError } from '@nestjs/apollo';
import { ScopedAccessService } from '../../modules/scoped-access/services/scoped-access.service';
export class BaseService<Entity extends BaseEntity | SecurityBaseEntity> {
  constructor(
    private repository: Repository<Entity>,
    protected loggerInBaseService?: LoggerService,
    protected scopedAccessService?: ScopedAccessService,
  ) {}

  public async baseFind(params: {
    options?: ListOptions;
    relationsToLoad?: Array<keyof Entity | string>;
    logSQLInBaseService?: boolean;
    manager?: EntityManager;
    cu?: JWTPayload; //Current User
    scopes?: ScopedAccessEnum[];
  }): Promise<ListSummary> {
    const {
      options,
      relationsToLoad,
      logSQLInBaseService = false,
      manager,
      cu,
      scopes,
    } = params;

    // Apply scope filters if user and scopes are provided.
    const scopeFilters =
      cu && this.scopedAccessService
        ? await this.scopedAccessService.forBaseFind(
            cu,
            this.repository,
            scopes,
          )
        : [];

    // Merge scope filters with existing options.
    const processedOptions = {
      ...(options || { skip: 0, take: 10 }),
      filters: [...(options?.filters || []), ...scopeFilters],
    };

    const mapper = new ListOptionsTypeOrmQueryBuilderMapper();

    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    const queryBuilder = mapper.mapToQueryBuilder(
      processedOptions,
      repository,
      relationsToLoad,
      { filterRelations: true },
    );

    if (this.loggerInBaseService && logSQLInBaseService) {
      const sql = queryBuilder.getSql();
      if (this.loggerInBaseService) {
        this.loggerInBaseService.debug('Query at baseFind', {
          sql,
          options: processedOptions,
        });
      }
    }

    const [data, totalCount] =
      processedOptions?.take === 0
        ? [[], await queryBuilder.getCount()]
        : await queryBuilder.getManyAndCount();

    return { data, totalCount };
  }

  public async baseFindAll(params: {
    withDeleted?: boolean;
    manager?: EntityManager;
    cu: JWTPayload;
  }): Promise<Entity[]> {
    const { cu, withDeleted = false, manager } = params;
    if (!cu.role.includes(Role.SUPER)) {
      throw new ForbiddenError('Superuser role required for this operation');
    }
    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    const data = await repository.find({ withDeleted });
    return data ? data : [];
  }

  public async baseFindOne(params: {
    id: number;
    relationsToLoad?: FindOptionsRelations<Entity>;
    withDeleted?: boolean;
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
  }): Promise<Entity> {
    const {
      id,
      relationsToLoad,
      withDeleted = false,
      manager,
      cu,
      scopes,
    } = params;

    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    const where: FindOptionsWhere<Entity> = { id } as FindOptionsWhere<Entity>;
    if (cu && this.scopedAccessService) {
      const scopeFilters = this.scopedAccessService.forBaseFindOne(
        cu,
        repository,
        scopes,
      );

      if (scopeFilters.length > 0) {
        Object.assign(where, ...scopeFilters);
      }
    }
    const findOptions: FindOneOptions<Entity> = {
      where,
      relations: relationsToLoad,
      withDeleted,
    };

    const data = await repository.findOne(findOptions);
    if (!data) throw new NotFoundError();
    return data;
  }

  public async baseFindOneByFilters(params: {
    filters: FindOptionsWhere<Entity>;
    relationsToLoad?: FindOptionsRelations<Entity>;
    withDeleted?: boolean;
    manager?: EntityManager;
    cu?: JWTPayload; // Add current user parameter
    scopes?: ScopedAccessEnum[]; // Add scopes parameter
  }): Promise<Entity> {
    const {
      filters,
      relationsToLoad,
      withDeleted = false,
      manager,
      cu,
      scopes,
    } = params;

    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    // Start with base filters
    const where: FindOptionsWhere<Entity> = { ...filters };

    if (cu && this.scopedAccessService && scopes?.length) {
      const scopeFilters = this.scopedAccessService.forBaseFindOne(
        cu,
        repository,
        scopes,
      );
      Object.assign(where, ...scopeFilters);
    }

    const data = await repository.findOne({
      where,
      relations: relationsToLoad,
      withDeleted,
    });

    if (!data) throw new NotFoundError();
    return data;
  }

  public async baseFindByIds(params: {
    ids: number[];
    relationsToLoad?: FindOptionsRelations<Entity>;
    withDeleted?: boolean;
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
  }): Promise<Entity[]> {
    const {
      ids,
      relationsToLoad,
      withDeleted = false,
      manager,
      cu,
      scopes,
    } = params;

    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    // Prepare base where condition
    const where: FindOptionsWhere<Entity> = {
      id: In(ids),
    } as FindOptionsWhere<Entity>;

    // Apply scope filters if available
    if (cu && this.scopedAccessService && scopes?.length) {
      const scopeFilters = this.scopedAccessService.forBaseFindOne(
        cu,
        repository,
        scopes,
      );

      if (scopeFilters.length > 0) {
        // Merge all scope filters with AND logic
        Object.assign(where, ...scopeFilters);
      }
    }

    // Execute query with combined conditions
    const data = await repository.find({
      where,
      relations: relationsToLoad,
      withDeleted,
    });

    if (!data || data.length === 0) throw new NotFoundError();
    return data;
  }

  public async baseCreate(params: {
    data: DeepPartial<Entity>;
    uniqueFields?: string[];
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
    isSecurityBaseEntity?: boolean;
  }): Promise<Entity> {
    const { data, uniqueFields, manager, cu, scopes, isSecurityBaseEntity } =
      params;
    if (uniqueFields?.length) {
      for (const field of uniqueFields) {
        const dataInDB = await this.baseFind({
          options: {
            take: 0,
            filters: [
              {
                property: field,
                operator: ConditionalOperator.EQUAL,
                value: String(data[field] ?? ''),
              },
            ],
          },
        });
        if (dataInDB.totalCount > 0) {
          throw new ConflictError(`The value of ${field} already exists`);
        }
      }
    }

    // Aplicar reglas de seguridad si el DTO es SecurityBase y hay usuario
    let modifiedData;
    if (isSecurityBaseEntity && cu && data && this.scopedAccessService) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      modifiedData = this.scopedAccessService.forBaseCreate(cu, data, scopes);
    }

    const entity = this.repository.create(
      (modifiedData as DeepPartial<Entity>) ?? data,
    );
    try {
      const createData = manager
        ? await manager.save<Entity>(entity)
        : await this.repository.save(entity);

      return createData;
    } catch (error: unknown) {
      const err = error as { message: string };
      throw new InternalServerError(err.message);
    }
  }

  public async baseUpdate(params: {
    id: number;
    data: DeepPartial<Entity>;
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
    isSecurityBaseEntity?: boolean;
  }): Promise<Entity> {
    const { id, data, manager, cu, scopes, isSecurityBaseEntity } = params;

    // 1. Primero validamos que la entidad exista y el usuario tenga acceso
    const dataInDB = await this.baseFindOne({ id, cu, scopes });
    if (!dataInDB) {
      throw new NotFoundError();
    }

    // 2. Aplicar reglas de seguridad si es necesario
    let updateData = { ...data };
    if (isSecurityBaseEntity && cu && this.scopedAccessService) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      updateData = this.scopedAccessService.forBaseUpdate(
        cu,
        updateData,
        scopes,
      );
    }

    // 3. Combinar datos existentes con los nuevos
    const entity = this.repository.create({
      ...dataInDB,
      ...updateData,
      id, // Asegurar que el ID no se sobrescriba
    });

    // 4. Guardar usando transaction manager si está disponible
    return manager
      ? await manager.save<Entity>(entity)
      : await this.repository.save(entity);
  }

  public async baseDeleteMany(params: {
    ids: number[];
    softRemove?: boolean;
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
  }): Promise<Entity[]> {
    const { ids, softRemove = true, manager, cu, scopes } = params;
    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    const entities = await this.baseFindByIds({
      ids,
      manager,
      cu,
      scopes,
    });

    return softRemove
      ? repository.softRemove(entities)
      : repository.remove(entities);
  }

  public async baseDeleteOne(params: {
    id: number;
    softRemove?: boolean;
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
  }): Promise<Entity> {
    const { id, softRemove = true, manager, cu, scopes } = params;
    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    const entity = await this.baseFindOne({
      id,
      manager,
      cu,
      scopes,
    });

    return softRemove
      ? repository.softRemove(entity)
      : repository.remove(entity);
  }

  public async baseRestoreDeletedMany(params: {
    ids: number[];
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
  }): Promise<number> {
    const { ids, manager, cu, scopes } = params;
    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    // Use baseFindByIds with withDeleted: true
    const entities = await this.baseFindByIds({
      ids,
      manager,
      cu,
      scopes,
      withDeleted: true, // Include soft-deleted entities
    });

    // Filter only entities that were actually deleted
    const deletedEntities = entities.filter((e) => e.deletedAt !== null);

    if (deletedEntities.length > 0) {
      const validIds = deletedEntities
        .map((e) => e.id)
        .filter((id): id is number => id !== undefined);
      return (await repository.restore(validIds)).affected ?? 0;
    }
    return 0;
  }

  public getRepository() {
    return this.repository;
  }
}
