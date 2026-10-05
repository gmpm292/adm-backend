import { Module } from '@nestjs/common';

import { StatisticsResolver } from './resolvers/statistics.resolver';
import { StatisticsService } from './services/statistics.service';

/**
 * Read-only figures for the dashboard and the sales report, computed in the
 * database from the sales, inventory and payroll tables.
 */
@Module({
  providers: [StatisticsResolver, StatisticsService],
})
export class StatisticsModule {}
