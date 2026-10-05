import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { NoRoles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { Role } from '../../../core/enums/role.enum';
import { StatisticsFilterInput } from '../dto/statistics-filter.input';
import { StatisticsService } from '../services/statistics.service';

@Resolver()
export class StatisticsResolver {
  constructor(private readonly statisticsService: StatisticsService) {}

  @NoRoles(Role.USER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('dashboardStatistics')
  public dashboardStatistics(
    @CurrentUser() user: JWTPayload,
    @Args('input') input: StatisticsFilterInput,
  ) {
    return this.statisticsService.dashboard(user, input);
  }

  @NoRoles(Role.USER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('salesStatistics')
  public salesStatistics(
    @CurrentUser() user: JWTPayload,
    @Args('input') input: StatisticsFilterInput,
  ) {
    return this.statisticsService.sales(user, input);
  }
}
