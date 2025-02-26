// TODO
// import { Injectable, NestMiddleware, OnModuleInit } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';

// import { ConfigService } from '../config';

// import { AppLoggerService } from './logger.service';
// import { responseExclusion } from './response-exclusion.helper';

// import { ModuleRef } from '@nestjs/core';
// import { NotificationService } from '../../domain/modules/notification/services/notification.service';
// import { CreateNotificationInput } from '../../domain/modules/notification/dto/create-notification.input';
// import { Role } from '../../domain/core/enums/role.enum';
// import { NotificationTypeEnum } from '../../domain/core/enums/notification-types.enumn';

// @Injectable()
// export class LoggerMiddleware implements NestMiddleware, OnModuleInit {
//   private notificationService: NotificationService;

//   public constructor(
//     private configService: ConfigService,
//     private loggerService: AppLoggerService,
//     private readonly moduleRef: ModuleRef,
//   ) {}

//   onModuleInit() {
//     this.notificationService = this.moduleRef.get(NotificationService, {
//       strict: false,
//     });
//   }

//   public use(req: Request, res: Response, next: NextFunction): void {
//     try {
//       const buffers = this.getResponseBodyBuffers(res);

//       const start = Date.now();
//       res.on('finish', async () => {
//         const responseTime = Date.now() - start;
//         req['headers']['responseTime'] = responseTime.toString();

//         const { originalUrl } = req;
//         const isRequestingGraphqlEndpoint = originalUrl.endsWith('graphql');

//         //const responseStatus = res.statusCode;

//         isRequestingGraphqlEndpoint
//           ? await this.logGraphQLRequest(req, buffers)
//           : await this.logHttpRequest(req, res, buffers);
//       });
//     } catch (e) {
//       console.log('Error en el midleware: ', e.message || e);
//     }

//     // Call the next controller

//     next();
//   }

//   /**
//    * Tries to parse the response in a JSON, if it can't it returns an empty JSON
//    *
//    * @param buffers Array of buffers with the response content
//    * @private
//    */
//   private static buffersToJSON(
//     buffers: Buffer[],
//   ): Record<string, string> | string {
//     try {
//       return JSON.parse(Buffer.concat(buffers).toString('utf8'));
//     } catch (e) {
//       return {};
//     }
//   }

//   /**
//    * Collect the complete response in a buffers array
//    *
//    * @param res Response
//    */
//   private getResponseBodyBuffers(res: Response): Buffer[] {
//     const buffers = [];

//     // Handler to manage the proxies of 'write' and 'end' functions
//     const proxyHandler = {
//       apply(target, thisArg, argumentsList): unknown {
//         const contentType = res.getHeader('content-type');

//         if (
//           typeof contentType === 'string' &&
//           (contentType.includes('json') || contentType.includes('text')) &&
//           argumentsList.length
//         ) {
//           buffers.push(argumentsList[0]);
//         }
//         return target.call(thisArg, ...argumentsList);
//       },
//     };

//     // Proxy this function to build the response content
//     res.write = new Proxy(res.write, proxyHandler);
//     res.end = new Proxy(res.end, proxyHandler);

//     return buffers;
//   }

//   private async logGraphQLRequest(req: Request, buffers: Buffer[]) {
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     const { body, headers, ip, originalUrl } = req;
//     const user = (req as any).user;
//     const response = LoggerMiddleware.prepareGraphqlResponse(buffers);
//     const isErrorResponse = Boolean(response['errors']);

//     // Retrieve data to write in the log
//     const status = isErrorResponse ? 'ERROR' : 'OK';
//     //const message = `POST ${originalUrl} ${status}`;
//     let message = `STATUS:${status}, OPERATION NAME:${
//       body['operationName'] || body['query']?.split(' ')[1].split(' ')[0]
//     }`;

//     const meta = {
//       request: {
//         body,
//         ip,
//         cookie: headers.cookie,
//         origin: headers.origin,
//         responseTime: headers.responseTime,
//         userAgent: headers['user-agent'],
//         timeZone: headers['timezone'],
//         headers: headers,
//       },
//       response: {
//         response: responseExclusion.some((re) =>
//           message.includes(`OPERATION NAME:${re}`),
//         )
//           ? 'response in exclusion list'
//           : response,
//         responseTime: headers.responseTime,
//       },
//       user,
//     };

//     const size = Buffer.byteLength(JSON.stringify(meta.response));
//     //max size: 1 mB.
//     if (size >= 1048576) {
//       message += ', WARN: Response was too big';
//       meta.response.response = `response was too big. (size: ${size / 1024}kB)`;

//       const notification = await this.notificationService.create(false, {
//         tipo: NotificationTypeEnum.Warning,
//         titulo: 'Log Warning',
//         message: `One response was too big. (size: ${size / 1024}kB)`,
//         roles: [String(Role.SUPER)],
//       } as CreateNotificationInput);
//       await this.notificationService.publishNotification(notification.id);

//       await this.loggerService.warn(message, meta);
//       return;
//     }

//     // It logs depending on response type
//     if (isErrorResponse) {
//       const intServErrorId = (meta as any).response?.response?.errors
//         ?.extensions?.intServErrorId;
//       intServErrorId
//         ? await this.loggerService.internalServerError(
//             message,
//             meta,
//             intServErrorId,
//           )
//         : await this.loggerService.error(message, meta);
//     } else {
//       await this.loggerService.info(message, meta);
//     }
//   }

//   private async logHttpRequest(req: Request, res: Response, buffers: Buffer[]) {
//     const { body, headers, ip, method, originalUrl, params, query } = req;
//     const { statusCode, statusMessage } = res;
//     const isErrorResponse = statusCode >= 400;

//     // Retrieve data to write in the log
//     const message = `${method} ${originalUrl} ${statusCode} ${statusMessage}`;
//     const meta = {
//       request: {
//         ip,
//         origin: headers.origin,
//         responseTime: headers.responseTime,
//         userAgent: headers['user-agent'],
//         timeZone: headers['timezone'],
//         headers: headers,
//       },
//       response: {
//         body: LoggerMiddleware.buffersToJSON(buffers),
//         responseTime: headers.responseTime,
//       },
//     };

//     if (Object.keys(body).length) {
//       Object.assign(meta, { body });
//     }

//     if (Object.keys(params).length) {
//       Object.assign(meta, { params });
//     }

//     if (Object.keys(query).length) {
//       Object.assign(meta, { query });
//     }

//     if (Object.keys(headers).length) {
//       Object.assign(meta, { headers });
//     }

//     // It logs depending on response type
//     isErrorResponse
//       ? await this.loggerService.error(message, meta)
//       : await this.loggerService.info(message, meta);
//   }

//   private static prepareGraphqlResponse(
//     buffers: Buffer[],
//   ): Record<string, string> | string {
//     const responseJSON = LoggerMiddleware.buffersToJSON(buffers);
//     const error = responseJSON?.['errors']?.[0];
//     const extensions = error?.['extensions'];

//     if (error) {
//       Object.assign(responseJSON, {
//         errors: {
//           extensions,
//           message: extensions?.['message'] ?? error['message'],
//         },
//       });
//     }

//     return responseJSON;
//   }
// }
