/* eslint-disable no-constant-condition */
import { ConfigService, Environment } from '../../config';
import { AppLoggerService } from '../../logger/logger.service';

export function playground(
  loggerService: AppLoggerService,
  configService: ConfigService,
): boolean {
  // Remove playground in production
  let result = true;
  if (configService.get<Environment>('NODE_ENV') === Environment.Production) {
    result = false;
  }
  return result;
}
