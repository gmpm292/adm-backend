// import { Injectable } from '@nestjs/common';

// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { BaseService } from '@app/domain/core/services/base.service';
// import {
//   ListFilter,
//   ListOptions,
//   ListOptionsTypeOrmQueryBuilderMapper,
//   ListSummary,
// } from '@app/domain/core/graphql/remote-operations';
// import { LogicalOperator } from '@app/domain/core/graphql/remote-operations/enums/logical-operator.enum';
// import { ConditionalOperator } from '@app/domain/core/graphql/remote-operations/enums/conditional-operation.enum';
// import { SortDirection } from '@app/domain/core/graphql/remote-operations/enums/sort-direction.enum';
// import { Log } from '../entities/log.entity';

// @Injectable()
// export class LogPostgresService extends BaseService<Log> {
//   constructor(@InjectRepository(Log) private logRepository: Repository<Log>) {
//     super(logRepository);
//   }

//   async create(createLog: Log): Promise<Log> {
//     return super.baseCreate(createLog);
//   }

//   async find(options?: ListOptions): Promise<ListSummary> {
//     // Block for create log. TODO delete.
//     const mapper = new ListOptionsTypeOrmQueryBuilderMapper();
//     const queryBuilder = mapper.mapToQueryBuilder(
//       options,
//       this.logRepository,
//       [],
//     );
//     const sql = queryBuilder.getSql();
//     const createdAt = new Date();
//     this.create({
//       createdAt,
//       level: 'debug',
//       message: 'Query at Find Logs',
//       meta: {
//         sql,
//         options,
//       },
//     } as Log);
//     console.log({
//       createdAt,
//       level: 'debug',
//       message: 'Query at Find Logs',
//       meta: {
//         sql,
//         options,
//       },
//     } as Log);
//     // End block for create log. TODO delete.

//     return await super.baseFind(options);
//   }

//   async findAll(
//     startDate?: string,
//     endDate?: string,
//     levelFilter?: string,
//     messageContain?: string,
//     intServErrorId?: string,
//     userId?: number,
//     skip = 0,
//     take = 20,
//   ): Promise<{ logs: Log[]; totalCount: number }> {
//     const options: ListOptions = {
//       skip,
//       take,
//       filters: [],
//       sorts: [{ property: 'createdAt', direction: SortDirection.DESC }],
//     };

//     if (startDate) {
//       options.filters.push({
//         property: 'createdAt',
//         operator: ConditionalOperator.GREATER_EQUAL_THAN,
//         value: startDate,
//         logicalOperator: LogicalOperator.AND,
//       } as ListFilter);
//     }
//     if (endDate) {
//       options.filters.push({
//         property: 'createdAt',
//         operator: ConditionalOperator.LESS_EQUAL_THAN,
//         value: endDate,
//         logicalOperator: LogicalOperator.AND,
//       } as ListFilter);
//     }
//     if (levelFilter) {
//       options.filters.push({
//         property: 'level',
//         operator: ConditionalOperator.EQUAL,
//         value: levelFilter,
//         logicalOperator: LogicalOperator.AND,
//       } as ListFilter);
//     }

//     if (messageContain) {
//       options.filters.push({
//         property: 'message',
//         operator: ConditionalOperator.CONTAINS,
//         value: messageContain,
//         logicalOperator: LogicalOperator.AND,
//       } as ListFilter);
//     }

//     // if (intServErrorId) {
//     //   options.filters.push({
//     //     property: 'meta',
//     //     operator: ConditionalOperator.ANY_OPERATOR_AND_VALUE,
//     //     value: `->>'intServErrorId'='${intServErrorId}'`,
//     //     logicalOperator: LogicalOperator.AND,
//     //   } as ListFilter);
//     // }

//     if (intServErrorId) {
//       options.filters.push({
//         property: 'intServErrorId',
//         operator: ConditionalOperator.CONTAINS,
//         value: intServErrorId,
//         logicalOperator: LogicalOperator.AND,
//       } as ListFilter);
//     }

//     if (userId) {
//       options.filters.push({
//         property: 'userId',
//         operator: ConditionalOperator.EQUAL,
//         value: String(userId),
//         logicalOperator: LogicalOperator.AND,
//       } as ListFilter);
//     }

//     const logsList: ListSummary = await this.find(options);

//     return { logs: logsList.data as Log[], totalCount: logsList.totalCount };
//   }

//   async findOne(id: number): Promise<Log> {
//     const log = await super.baseFindOne(id);
//     // const created = moment(log.createdAt).subtract(2, 'minute');
//     // const createdafter = created.clone().add(2, 'minute').toDate();
//     // let relation;
//     // const qb = this.logRepository
//     //   .createQueryBuilder('log')
//     //   .where(`log.createdAt BETWEEN :date1 and :date2`, {
//     //     date1: created.toDate(),
//     //     date2: createdafter,
//     //   });
//     // //load relation with request
//     // if (log.level === 'internalServerError') {
//     //   relation = await qb
//     //     .andWhere(
//     //       `log.meta->
//     //         'response'->
//     //           'response'->
//     //             'errors'->
//     //               'extensions'->>'intServErrorId' = :intServErrorId`,
//     //       { intServErrorId: log.meta.intServErrorId },
//     //     )
//     //     .getOne();

//     //   log.meta = { ...log.meta, relation };
//     // }
//     // //load relation with internalServerError
//     // if (
//     //   log.level === 'error' &&
//     //   log.meta?.response?.response?.errors?.extensions?.intServErrorId
//     // ) {
//     //   relation = await qb
//     //     .andWhere(`log.meta ->>'intServErrorId' = :intServErrorId`, {
//     //       intServErrorId:
//     //         log.meta.response.response.errors.extensions.intServErrorId,
//     //     })
//     //     .getOne();

//     //   log.meta = { ...log.meta, relation };
//     // }
//     return log;
//   }
// }
