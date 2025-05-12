import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerModule } from './worker/worker.module';
import { WorkerPaymentModule } from './worker-payment/worker-payment.module';
import { PaymentRuleModule } from './payment-rule/payment-rule.module';
import { PayrollPeriodModule } from './payroll-period/payroll-period.module';
import { CurrencyModule } from './currency/currency.module';
import { WorkScheduleModule } from './work-schedule/work-schedule.module';
import { OfficeModule } from '../company/office/office.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),

    // Módulos internos del payroll (con forwardRef para dependencias circulares)
    forwardRef(() => WorkerModule),
    forwardRef(() => WorkerPaymentModule),
    forwardRef(() => PaymentRuleModule),
    forwardRef(() => PayrollPeriodModule),
    forwardRef(() => CurrencyModule),
    forwardRef(() => WorkScheduleModule),

    // Módulos externos requeridos
    forwardRef(() => OfficeModule),
    forwardRef(() => UsersModule),
  ],
  providers: [],
  exports: [
    WorkerPaymentModule,
    PaymentRuleModule,
    WorkerModule,
    PayrollPeriodModule,
    CurrencyModule,
    WorkScheduleModule,
  ],
})
export class PayrollModule {}
