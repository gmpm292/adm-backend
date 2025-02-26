/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { GraphQLFormattedError } from 'graphql';

import { AppLoggerService } from '../../logger/logger.service';
import { v4 as uuid } from 'uuid';
import { AppErrorInput } from '../../../core/errors/interfaces/appError.input';
import { AppErrorCode } from '../../../core/errors/AppErrorCode.enum';

export function formatError(
  formattedError: GraphQLFormattedError,
  error: any,
  loggerService: AppLoggerService,
): GraphQLFormattedError {
  const message = error.message;
  const extensions = { ...error.extensions, ...formattedError.extensions };
  const { originalError, code } = extensions;
  const origin =
    formattedError.extensions?.originalError ||
    originalError ||
    error?.originalError?.response ||
    message ||
    error;
  if (message) {
    let errorJSON: AppErrorInput;
    try {
      errorJSON = JSON.parse(message);
    } catch (err) {
      if (code == 'BAD_USER_INPUT' || code == 'GRAPHQL_VALIDATION_FAILED') {
        errorJSON = { code: AppErrorCode.BadRequestError, message };
      } else if (code == 'FORBIDDEN') {
        errorJSON = { code: AppErrorCode.ForbiddenResourceError, message };
      } else if (originalError && originalError.statusCode != 500) {
        errorJSON = {
          code: String(originalError.statusCode),
          message: originalError.message,
        };
      } else {
        switch (message) {
          case 'Unauthorized': {
            errorJSON = { code: AppErrorCode.UnauthorizedError, message };
            break;
          }
          case 'Forbidden resource': {
            errorJSON = { code: AppErrorCode.ForbiddenResourceError, message };
            break;
          }
          case 'Bad Request Exception': {
            errorJSON = { code: AppErrorCode.BadRequestError, message };
            break;
          }
          case findTerm(message, 'connect ECONNREFUSED'): {
            errorJSON = { code: AppErrorCode.ServiceUnavailableError, message };
            break;
          }
          default: {
            const intServErrorId = uuid();
            const meta = {
              intServErrorId,
              extensions,
              origin,
              stack: error.stack,
            };
            loggerService.saveInternalServerError(message || error, meta);
            errorJSON = {
              message: `Internal Server Error. Id: ${intServErrorId}`,
              code: AppErrorCode.InternalServerError,
            };
            return {
              message: errorJSON.message,
              extensions: {
                code: errorJSON.code,
                stack: error.stack,
                intServErrorId,
              },
              origin,
            } as any;
          }
        }
      }
    }

    return {
      message: errorJSON.message,
      extensions: {
        code: errorJSON.code,
        stack: error.stack,
      },
      origin,
    } as any;
  }
  return { ...error, origin };
}

export const findTerm = (message: string, term: string) => {
  return message.includes(term) ? message : '';
};
