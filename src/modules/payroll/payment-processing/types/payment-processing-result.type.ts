export interface PaymentProcessingResult {
  workerId: number;
  workerName?: string;
  amount: number;
  currency: string;
  paymentConcept: string;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'ERROR' | 'SKIPPED';
  errors?: string[];
  details?: Record<string, unknown> | null;
}
