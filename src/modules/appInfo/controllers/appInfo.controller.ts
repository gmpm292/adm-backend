import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { AppInfoService } from '../services/appInfo.service';

@Controller()
export class AppInfoController {
  constructor(
    private readonly appService: AppInfoService,
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private http: HttpHealthIndicator,
  ) {}

  @Get('/appInfo')
  public appInfo() {
    return this.appService.appInfo();
  }

  @Get('/readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([
      async () => this.db.pingCheck('postgresql', { timeout: 3000 }),
    ]);
  }

  @Get('/liveness')
  @HealthCheck()
  liveness() {
    return this.health.check([
      //async () => this.http.pingCheck('nestjs', 'https://www.google.com'),
      () => ({ status: 'up' }) as unknown as HealthIndicatorResult,
    ]);
  }
}
