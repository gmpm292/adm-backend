import { ConfigService, Environment } from '../../config';
import { AppLoggerService } from '../../logger/logger.service';

/** Playground activo salvo con `NODE_ENV=production`. */
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
