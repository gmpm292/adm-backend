import { forwardRef, Module } from '@nestjs/common';
import { PaymentRollbackService } from './services/payment-rollback.service';
import { WorkerPaymentModule } from '../worker-payment/worker-payment.module';
import { PayrollPeriodModule } from '../payroll-period/payroll-period.module';

/**
 * Aislado de PaymentProcessingModule porque este último importa SaleModule,
 * y SaleService también necesita PaymentRollbackService (para refundSale):
 * importar PaymentProcessingModule desde SaleModule crearía un ciclo.
 */
@Module({
  imports: [
    forwardRef(() => WorkerPaymentModule),
    forwardRef(() => PayrollPeriodModule),
  ],
  providers: [PaymentRollbackService],
  exports: [PaymentRollbackService],
})
export class PaymentRollbackModule {}
