// import { UseGuards } from '@nestjs/common';
// import { Args, Query, Resolver } from '@nestjs/graphql';
// // import { RoleGuard } from '@app/domain/auth/guards/role.guard';
// // import { AccessTokenAuthGuard } from '../../../../modules/auth/guards/access-token-auth.guard';
// // import { InternalServerError, Role } from '@app/shared/core';
// // import { Roles } from '../../../../modules/auth/decorators/roles.decorator';
// import { LogPostgresService } from '../services/log-postgres.service';
// import { Roles } from '../../../../domain/modules/auth/decorators/roles.decorator';
// import { Role } from '../../../../domain/core/enums/role.enum';
// import { AccessTokenAuthGuard } from '../../../../domain/modules/auth/guards/access-token-auth.guard';
// import { RoleGuard } from '../../../../domain/modules/auth/guards/role.guard';
// import { InternalServerError } from '../../../../domain/core/errors/appErrors/InternalServerError.error';
// import { Log } from '../entities/log.entity';
// // import { Log } from '@app/shared/entities';

// @Resolver('log')
// export class LogResolver {
//   constructor(private readonly logService: LogPostgresService) {}

//   @Roles(Role.SUPER)
//   @UseGuards(AccessTokenAuthGuard, RoleGuard)
//   @Query('logs')
//   async findAll(
//     @Args('options')
//     options: {
//       startDate?: string;
//       endDate?: string;
//       levelFilter?: string;
//       messageContain?: string;
//       intServErrorId?: string;
//       userId: number;
//       skip?: number;
//       limit?: number;
//     },
//   ): Promise<{ logs: any[]; totalCount: number }> {
//     const {
//       startDate,
//       endDate,
//       levelFilter,
//       messageContain,
//       intServErrorId,
//       userId,
//       skip,
//       limit,
//     } = options;

//     const cappedLimit = Math.min(limit ?? 50, 50);
//     try {
//       const { logs, totalCount } = await this.logService.findAll(
//         startDate,
//         endDate,
//         levelFilter,
//         messageContain,
//         intServErrorId,
//         userId,
//         skip,
//         cappedLimit,
//       );

//       const logsString = logs.map((log) => {
//         return {
//           id: log.id,
//           level: log.level,
//           createdAt: log.createdAt,
//           message: log.message,
//           meta: JSON.stringify(log.meta),
//         };
//       });

//       return {
//         logs: logsString,
//         totalCount,
//       };
//     } catch (e) {
//       throw new InternalServerError(e.message);
//     }
//   }

//   @Roles(Role.SUPER)
//   @UseGuards(AccessTokenAuthGuard, RoleGuard)
//   @Query('log')
//   async findOne(@Args('id') id: number): Promise<Log> {
//     return this.logService.findOne(id);
//   }
// }
