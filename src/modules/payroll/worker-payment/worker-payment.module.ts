import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerPaymentResolver } from './resolvers/worker-payment.resolver';
import { WorkerPaymentService } from './services/worker-payment.service';
import { WorkerPayment } from './entities/worker-payment.entity';
import { PayrollPeriod } from '../payroll-period/entities/payroll-period.entity';
import { WorkerModule } from '../worker/worker.module';
import { PayrollPeriodModule } from '../payroll-period/payroll-period.module';
import { CurrencyModule } from '../currency/currency.module';
import { Worker } from '../worker/entities/worker.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkerPayment, Worker, PayrollPeriod]),
    forwardRef(() => WorkerModule),
    forwardRef(() => PayrollPeriodModule),
    forwardRef(() => CurrencyModule),
  ],
  providers: [WorkerPaymentResolver, WorkerPaymentService],
  exports: [WorkerPaymentResolver, WorkerPaymentService],
})
export class WorkerPaymentModule {}
