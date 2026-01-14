import { Module } from '@nestjs/common';
import { PaymentProcessingService } from './servicesss/payment-processing.service';
import { FixedAmountPaymentService } from './servicesss/fixed-amount-payment.service';
import { PercentagePaymentService } from './servicesss/percentage-payment.service';
import { SaleQuantityPaymentService } from './servicesss/sale-quantity-payment.service';
import { PriceRangePaymentService } from './servicesss/price-range-payment.service';

@Module({
  providers: [
    PaymentProcessingService,
    FixedAmountPaymentService,
    PercentagePaymentService,
    SaleQuantityPaymentService,
    PriceRangePaymentService,
  ],
  exports: [
    PaymentProcessingService,
    FixedAmountPaymentService,
    PercentagePaymentService,
    SaleQuantityPaymentService,
    PriceRangePaymentService,
  ],
})
export class PaymentProcessingModule {}
