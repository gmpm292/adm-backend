import { Injectable } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';

import { ListSummary } from '../models/list-summary.interface';
import { ListOptionsTypeOrmQueryBuilderMapper } from '../mappers/list-options-type-orm-query-builder.mapper';
import { ListOptions } from '../models/list-options.interface';

@Injectable()
export class RemoteOperationsService<Entity extends ObjectLiteral> {
  public async find(
    options: ListOptions,
    repository: Repository<Entity>,
    relationsToLoad?: Array<keyof Entity | string>,
  ): Promise<ListSummary> {
    options = options ? options : { skip: 0, take: 10 };
    const mapper = new ListOptionsTypeOrmQueryBuilderMapper();

    const queryBuilder = mapper.mapToQueryBuilder(
      options,
      repository,
      relationsToLoad,
    );

    const [data, totalCount] =
      options?.take === 0
        ? [[], await queryBuilder.getCount()]
        : await queryBuilder.getManyAndCount();

    return { data, totalCount };
  }
}
