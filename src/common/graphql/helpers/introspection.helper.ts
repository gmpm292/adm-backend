/* eslint-disable no-constant-condition */
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config';
import { AppLoggerService } from '../../logger/logger.service';

export function introspection(
  loggerService: AppLoggerService,
  configService: ConfigService,
): boolean {
  // Remove introspection in production
  let result = true;

  if (configService.get<Environment>('NODE_ENV') === Environment.Production) {
    result = false;
  }
  return result;
}
