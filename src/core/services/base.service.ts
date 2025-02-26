import {
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsRelations,
  FindOptionsWhere,
  In,
  IsNull,
  Not,
  Repository,
  UpdateResult,
} from 'typeorm';

import {
  ListOptions,
  ListOptionsTypeOrmQueryBuilderMapper,
  ListSummary,
} from '../graphql/remote-operations';

import { ConditionalOperator } from '../graphql/remote-operations/enums/conditional-operation.enum';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { BaseEntity } from '../entities/base.entity';
import { NotFoundError } from '../errors/appErrors/NotFoundError.error';
import { ConflictError } from '../errors/appErrors/ConflictError.error';
import { InternalServerError } from '../errors/appErrors/InternalServerError.error';
//import { LoggerService } from '../../../common/logger';

export class BaseService<Entity extends BaseEntity> {
  constructor(
    private repository: Repository<Entity>,
    //private loggerInBaseService?: LoggerService,
  ) {}

  public async baseFind(
    options: ListOptions,
    relationsToLoad?: Array<keyof Entity | string>,
  ): Promise<ListSummary> {
    options = options ? options : { skip: 0, take: 10 };
    const mapper = new ListOptionsTypeOrmQueryBuilderMapper();

    const queryBuilder = mapper.mapToQueryBuilder(
      options,
      this.repository,
      relationsToLoad,
      { filterRelations: true },
    );

    //const sql = queryBuilder.getSql();
    // if (this.loggerInBaseService) {
    //   this.loggerInBaseService.debug('Query at baseFind', {
    //     sql,
    //     options,
    //   });
    // }

    const [data, totalCount] =
      options?.take === 0
        ? [[], await queryBuilder.getCount()]
        : await queryBuilder.getManyAndCount();

    return { data, totalCount };
  }

  public async baseFindAll(withDeleted = false): Promise<Entity[]> {
    const data = await this.repository.find({ withDeleted });
    return data ? data : [];
  }

  public async baseFindOne(
    id: number,
    relationsToLoad?: Array<keyof Entity> | FindOptionsRelations<Entity>,
    withDeleted = false,
  ): Promise<Entity> {
    const data = await this.repository.findOne({
      where: { id } as FindOptionsWhere<Entity>,
      relations: relationsToLoad,
      withDeleted,
    } as FindOneOptions<Entity>);
    if (!data) {
      throw new NotFoundError();
    }
    return data;
  }

  public async baseFindOneByFilters(
    filters: FindOptionsWhere<Entity>,
    relationsToLoad?: Array<keyof Entity> | FindOptionsRelations<Entity>,
    withDeleted = false,
  ): Promise<Entity> {
    const data = await this.repository.findOne({
      where: filters,
      relations: relationsToLoad,
      withDeleted,
    } as FindOneOptions<Entity>);
    if (!data) {
      throw new NotFoundError();
    }
    return data;
  }

  public async baseFindByIds(
    ids: number[],
    relationsToLoad?: Array<keyof Entity> | FindOptionsRelations<Entity>,
    withDeleted = false,
  ): Promise<Entity[]> {
    const data = await this.repository.find({
      where: { id: In(ids) },
      relations: relationsToLoad,
      withDeleted,
    } as FindManyOptions);
    if (!data) {
      throw new NotFoundError();
    }
    return data;
  }

  async baseCreate(
    data: DeepPartial<Entity>,
    uniqueFields?: string[],
    manager?: EntityManager,
  ): Promise<Entity> {
    if (uniqueFields?.length) {
      for (let index = 0; index < uniqueFields.length; index++) {
        const dataInDB = await this.baseFind({
          take: 0,
          filters: [
            {
              property: uniqueFields[index],
              operator: ConditionalOperator.EQUAL,
              value: String(data[uniqueFields[index]] ?? ''),
            },
          ],
        });
        if (dataInDB.totalCount > 0) {
          throw new ConflictError(
            `The value of ${uniqueFields[index]} already exist`,
          );
        }
      }
    }

    const entity = this.repository.create(data);
    let createData: Entity;
    try {
      createData = manager
        ? await manager.save<Entity>(entity)
        : await this.repository.save(entity);
    } catch (error: unknown) {
      const err = error as { message: string };
      throw new InternalServerError(err.message);
    }
    return createData;
  }

  async baseUpdate(
    id: number,
    data: DeepPartial<Entity>,
    manager?: EntityManager,
  ): Promise<Entity> {
    const dataInDB = await this.baseFindOne(id);
    if (!dataInDB) {
      throw new NotFoundError();
    }
    const entity = this.repository.create({ id, ...dataInDB, ...data });
    return manager
      ? await manager.save<Entity>(entity)
      : await this.repository.save(entity);
  }

  public async baseDeleteMany(
    ids: number[],
    filters?: FindOptionsWhere<Entity>[],
    softRemove = true,
  ): Promise<Entity[]> {
    const entities = await this.repository.findBy([
      {
        id: In(ids),
      },
      ...(filters ? filters : []),
    ] as FindOptionsWhere<Entity>[]);
    return softRemove
      ? this.repository.softRemove(entities)
      : this.repository.remove(entities);
  }

  public async baseDeleteOne(
    id: number,
    filters?: FindOptionsWhere<Entity>[],
    manager?: EntityManager,
    softRemove = true,
  ): Promise<Entity> {
    const entity = await this.repository.findOneBy([
      { id },
      ...(filters ? filters : []),
    ] as FindOptionsWhere<Entity>[]);

    if (!entity) {
      throw new NotFoundError();
    }

    if (manager) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return softRemove
        ? await manager.softRemove<Entity>([entity]).then((result) => result[0])
        : // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          await manager.remove<Entity>([entity]).then((result) => result[0]);
    }

    return softRemove
      ? await this.repository.softRemove([entity]).then((result) => result[0])
      : await this.repository.remove([entity]).then((result) => result[0]);
  }

  async baseRestoreDeletedMany(
    ids: number[],
    filters?: FindOptionsWhere<Entity>,
  ): Promise<number> {
    const entities = await this.repository.find({
      where: { id: In(ids), deletedAt: Not(IsNull()), ...(filters ?? {}) },
      withDeleted: true,
    } as FindManyOptions);
    if (entities.length > 0) {
      const validIds = entities
        .map((e) => e.id)
        .filter((id): id is number => id !== undefined);
      return (await this.repository.restore(validIds)).affected ?? 0;
    }
    return 0;
  }

  public async nativeUpdate(
    criteriaOrId: FindOptionsWhere<Entity> | number,
    partiatEntity: QueryDeepPartialEntity<Entity>,
  ): Promise<UpdateResult> {
    return await this.repository.update(criteriaOrId, partiatEntity);
  }

  public getRepository() {
    return this.repository;
  }
}
