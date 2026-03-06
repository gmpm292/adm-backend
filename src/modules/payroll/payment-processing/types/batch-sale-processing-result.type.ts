export interface BatchSaleProcessingResult {
  success: boolean;
  totalProcessed: number;
  successful: number;
  failed: number;
  results: Array<{
    saleId: number;
    success: boolean;
    paymentsCreated: number;
    totalAmount: number;
    error?: string;
    details: any[];
  }>;
}
