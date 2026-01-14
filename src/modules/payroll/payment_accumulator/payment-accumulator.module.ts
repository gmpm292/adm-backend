import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAccumulatorService } from './services/payment-accumulator.service';
import { PaymentAccumulatorResolver } from './resolvers/payment-accumulator.resolver';

import { ScopedAccessModule } from '../../scoped-access/scoped-access.module';
import { PaymentAccumulator } from './entities/payment_accumulator.entity';
import { WorkerModule } from '../worker/worker.module';
import { PaymentRuleModule } from '../payment-rule/payment-rule.module';
import { PayrollPeriodModule } from '../payroll-period/payroll-period.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentAccumulator]),
    forwardRef(() => WorkerModule),
    forwardRef(() => PaymentRuleModule),
    forwardRef(() => PayrollPeriodModule),
    ScopedAccessModule,
  ],
  providers: [PaymentAccumulatorResolver, PaymentAccumulatorService],
  exports: [PaymentAccumulatorResolver, PaymentAccumulatorService],
})
export class PaymentAccumulatorModule {}
