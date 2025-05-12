import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PayrollPeriod } from './entities/payroll-period.entity';
import { WorkerPaymentModule } from '../worker-payment/worker-payment.module';
import { PayrollPeriodResolver } from './resolvers/payroll-period.resolver';
import { PayrollPeriodService } from './services/payroll-period.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayrollPeriod]),
    forwardRef(() => WorkerPaymentModule),
  ],
  providers: [PayrollPeriodResolver, PayrollPeriodService],
  exports: [PayrollPeriodResolver, PayrollPeriodService],
})
export class PayrollPeriodModule {}
