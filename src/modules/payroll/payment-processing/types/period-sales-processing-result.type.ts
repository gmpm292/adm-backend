import { BatchSaleProcessingResult } from './batch-sale-processing-result.type';

export interface PeriodSalesProcessingResult {
  success: boolean;
  payrollPeriodId: number;
  totalSales: number;
  successful: number;
  failed: number;
  totalPaymentsCreated: number;
  totalAmount: number;
  results: BatchSaleProcessingResult['results'];
}
