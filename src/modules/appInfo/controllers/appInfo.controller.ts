import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { AppInfoService } from '../services/appInfo.service';
import {
  CurrentUser,
  CurrentUserWithContext,
} from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';

@Controller()
export class AppInfoController {
  constructor(
    private readonly appService: AppInfoService,
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private http: HttpHealthIndicator,
  ) {}

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Get('/appInfo')
  public appInfo(@CurrentUserWithContext() user: JWTPayload) {
    const a = user;
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
