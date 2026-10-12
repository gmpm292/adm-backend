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

/**
 * CRUD genérico del que heredan los servicios. Con `cu` (usuario actual) y
 * `scopedAccessService` aplica el alcance por empresa, oficina, etc.; con
 * `manager` trabaja dentro de la transacción recibida.
 */
export class BaseService<Entity extends BaseEntity | SecurityBaseEntity> {
  // Variable privada para controlar el nivel de detalle en errores
  private readonly showErrorDetails: boolean;

  constructor(
    private repository: Repository<Entity>,
    protected loggerInBaseService?: LoggerService,
    protected scopedAccessService?: ScopedAccessService,
  ) {
    // Determinar si mostrar detalles según NODE_ENV
    const nodeEnv = process.env.NODE_ENV || 'development';
    this.showErrorDetails = nodeEnv !== 'production';
  }

  // Método privado para construir mensajes de error
  private buildErrorMessage(
    entityName: string,
    message: string,
    details?: any,
  ): string {
    if (this.showErrorDetails) {
      return `${entityName} ${message}` + (details ? ` ${details}` : '');
    }
    return `${entityName} ${message}`;
  }

  // Método privado para obtener nombre de entidad
  private getEntityName(): string {
    return this.repository.metadata.name;
  }

  /**
   * Listado paginado con las opciones del cliente (filtros, orden, página)
   * más los filtros de alcance del usuario. Sin opciones devuelve los 10
   * primeros; con `take: 0` solo cuenta. Si las opciones vienen de `@Opts`,
   * de `relationsToLoad` solo une las que pide la consulta o usan los filtros.
   */
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
        ? this.scopedAccessService.forBaseFind(cu, this.repository, scopes)
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

  /** Todos los registros, sin paginar ni filtrar. Solo SUPER (si no, lanza). */
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

  /**
   * Un registro por id dentro del alcance del usuario (si llega `cu`, aunque
   * no se pasen `scopes`). Lanza NotFoundError si no existe o no lo ve.
   */
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

    const entityName = this.getEntityName();

    let where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[] = {
      id,
    } as FindOptionsWhere<Entity>;
    if (cu && this.scopedAccessService) {
      const scopeFilters = this.scopedAccessService.forBaseFindOne(
        cu,
        repository,
        scopes,
      );
      where = this.withScopeAlternatives(where, scopeFilters);
    }
    const findOptions: FindOneOptions<Entity> = {
      where,
      relations: relationsToLoad,
      withDeleted,
    };

    const data = await repository.findOne(findOptions);
    if (!data) {
      const details = this.showErrorDetails
        ? `con ID ${id}` + (cu ? ` para el usuario ${cu.sub}` : '')
        : '';
      throw new NotFoundError(
        this.buildErrorMessage(entityName, 'no encontrado', details),
      );
    }
    return data;
  }

  /**
   * El primer registro que cumple los filtros. A diferencia de `baseFindOne`,
   * el alcance solo se aplica si se pasan `scopes`. Lanza NotFoundError.
   */
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

    const entityName = this.getEntityName();

    // Start with base filters
    let where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[] = {
      ...filters,
    };

    if (cu && this.scopedAccessService && scopes?.length) {
      const scopeFilters = this.scopedAccessService.forBaseFindOne(
        cu,
        repository,
        scopes,
      );
      where = this.withScopeAlternatives(where, scopeFilters);
    }

    const data = await repository.findOne({
      where,
      relations: relationsToLoad,
      withDeleted,
    });

    if (!data) {
      const filterDetails = this.showErrorDetails
        ? ` con filtros: ${JSON.stringify(where)}`
        : '';
      throw new NotFoundError(
        this.buildErrorMessage(entityName, 'no encontrado', filterDetails),
      );
    }
    return data;
  }

  /**
   * Los registros de esos ids dentro del alcance. Los que no existen o no se
   * ven se omiten sin error; solo lanza NotFoundError si no queda ninguno.
   */
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

    const entityName = this.getEntityName();

    // Prepare base where condition
    let where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[] = {
      id: In(ids),
    } as FindOptionsWhere<Entity>;

    // Con o sin alcance explícito: sin él se aplica el de por defecto, igual
    // que en baseFindOne. Si no, eliminar o restaurar por lote no filtraba.
    if (cu && this.scopedAccessService) {
      const scopeFilters = this.scopedAccessService.forBaseFindOne(
        cu,
        repository,
        scopes,
      );
      where = this.withScopeAlternatives(where, scopeFilters);
    }

    // Execute query with combined conditions
    const data = await repository.find({
      where,
      relations: relationsToLoad,
      withDeleted,
    });

    if (!data || data.length === 0) {
      const details = this.showErrorDetails ? ` con IDs ${ids.join(', ')}` : '';
      throw new NotFoundError(
        this.buildErrorMessage(entityName, 'no encontrado', details),
      );
    }
    return data;
  }

  /**
   * Crea el registro. Con `uniqueFields` lanza ConflictError si ya hay otro
   * con el mismo valor (sin contar eliminados ni mirar el alcance). Con `cu`
   * completa empresa, oficina, etc. según el alcance; un fallo al guardar
   * sale como InternalServerError.
   */
  public async baseCreate(params: {
    data: DeepPartial<Entity>;
    uniqueFields?: string[];
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
    isSecurityBaseEntity?: boolean;
  }): Promise<Entity> {
    const {
      data,
      uniqueFields,
      manager,
      cu,
      scopes,
      isSecurityBaseEntity = true,
    } = params;

    const entityName = this.getEntityName();

    if (uniqueFields?.length) {
      for (const field of uniqueFields) {
        if (data[field] ?? null) {
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
            const details = this.showErrorDetails
              ? `: ${field}=${data[field]}`
              : '';
            throw new ConflictError(
              this.buildErrorMessage(entityName, 'ya existe', details),
            );
          }
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

  /**
   * Mezcla los datos nuevos con los guardados y guarda. Exige que el registro
   * esté en el alcance del usuario; las reglas de alcance sobre los datos
   * solo se aplican con `isSecurityBaseEntity: true` (aquí no es el defecto).
   */
  public async baseUpdate(params: {
    id: number;
    data: DeepPartial<Entity>;
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
    isSecurityBaseEntity?: boolean;
  }): Promise<Entity> {
    const { id, data, manager, cu, scopes, isSecurityBaseEntity } = params;

    const entityName = this.getEntityName();

    // 1. Primero validamos que la entidad exista y el usuario tenga acceso
    // Con el mismo manager: dentro de una transacción la fila puede no estar
    // confirmada todavía y otra conexión no la vería.
    const dataInDB = await this.baseFindOne({ id, cu, scopes, manager });
    if (!dataInDB) {
      const details = this.showErrorDetails ? ` con ID ${id}` : '';
      throw new NotFoundError(
        this.buildErrorMessage(
          entityName,
          'no encontrado para actualizar',
          details,
        ),
      );
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

  /**
   * Elimina los registros de esos ids que el usuario ve: borrado lógico por
   * defecto, definitivo con `softRemove: false`.
   */
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

  /** Como `baseDeleteMany` para un solo id; lanza NotFoundError si no lo ve. */
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

    const entityName = this.getEntityName();

    const entity = await this.baseFindOne({
      id,
      manager,
      cu,
      scopes,
    });

    if (!entity) {
      const details = this.showErrorDetails ? ` con ID ${id}` : '';
      throw new NotFoundError(
        this.buildErrorMessage(
          entityName,
          'no encontrado para eliminar',
          details,
        ),
      );
    }

    return softRemove
      ? repository.softRemove(entity)
      : repository.remove(entity);
  }

  /**
   * Restaura los eliminados de esos ids dentro del alcance y devuelve
   * cuántos. Lanza NotFoundError si ninguno estaba eliminado.
   */
  public async baseRestoreDeletedMany(params: {
    ids: number[];
    manager?: EntityManager;
    cu?: JWTPayload;
    scopes?: ScopedAccessEnum[];
  }): Promise<number> {
    const { ids, manager, cu, scopes } = params;
    const repository =
      manager?.getRepository<Entity>(this.repository.target) || this.repository;

    const entityName = this.getEntityName();

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

    // Si no hay entidades eliminadas para restaurar
    const details = this.showErrorDetails ? ` con IDs ${ids.join(', ')}` : '';
    throw new NotFoundError(
      this.buildErrorMessage(
        entityName,
        'no eliminado para restaurar',
        details,
      ),
    );
  }

  public getRepository() {
    return this.repository;
  }

  /**
   * `forBaseFindOne` devuelve alternativas (GENERAL, PERSONAL, jerárquico)
   * que valen con OR, como en `baseFind`: cada una se combina con la
   * condición base y TypeORM une con OR los elementos del array. Mezclarlas
   * en un objeto las cruzaba con AND (y una pisaba las claves de otra).
   */
  private withScopeAlternatives(
    where: FindOptionsWhere<Entity>,
    scopeFilters: FindOptionsWhere<Entity>[],
  ): FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[] {
    if (scopeFilters.length === 0) return where;
    return scopeFilters.map((scope) => ({ ...where, ...scope }));
  }
}
