import { PaymentProcessingResult } from './payment-processing-result.type';

export interface PaymentProcessingSummary {
  data: PaymentProcessingResult[];
  totalCount: number;
  successCount: number;
  errorCount: number;
}
