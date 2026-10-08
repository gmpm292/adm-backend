import { Module } from '@nestjs/common';
import { PaymentProcessingService } from './services/payment-processing.service';
import { FixedAmountProcessor } from './services/payment-processors/fixed-amount-processor';
import { PercentageProcessor } from './services/payment-processors/percentage-processor';
import { SaleQuantityProcessor } from './services/payment-processors/sale-quantity-processor';
import { PriceRangeProcessor } from './services/payment-processors/price-range-processor';
import { RealTimePaymentService } from './services/real-time-payment.service';
import { PaymentPeriodService } from './services/payment-period.service';
import { PaymentProcessingResolver } from './resolvers/payment-processing.resolver';
import { PaymentRollbackModule } from './payment-rollback.module';
import { WorkerModule } from '../worker/worker.module';
import { PaymentRuleModule } from '../payment-rule/payment-rule.module';
import { PayrollPeriodModule } from '../payroll-period/payroll-period.module';
import { WorkerPaymentModule } from '../worker-payment/worker-payment.module';
import { PaymentAccumulatorModule } from '../payment_accumulator/payment-accumulator.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { SaleModule } from '../../sales/sale/sale.module';
import { BusinessModule } from '../../company/business/business.module';
import { OfficeModule } from '../../company/office/office.module';
import { DepartmentModule } from '../../company/department/department.module';
import { TeamModule } from '../../company/team/team.module';

@Module({
  imports: [
    // Módulos de entidades principales
    WorkerModule,
    PaymentRuleModule,
    PayrollPeriodModule,
    WorkerPaymentModule,
    PaymentAccumulatorModule,
    AttendanceModule,
    PaymentRollbackModule,

    // Módulo de ventas
    SaleModule,

    // Módulos de estructura organizativa (para scope calculations)
    BusinessModule,
    OfficeModule,
    DepartmentModule,
    TeamModule,
  ],
  providers: [
    //services
    PaymentProcessingService,
    RealTimePaymentService,
    PaymentPeriodService,

    //Processors
    FixedAmountProcessor,
    PercentageProcessor,
    SaleQuantityProcessor,
    PriceRangeProcessor,

    //resolver
    PaymentProcessingResolver,
  ],
  exports: [
    PaymentProcessingService,
    RealTimePaymentService,
    PaymentPeriodService,
  ],
})
export class PaymentProcessingModule {}
