import { PaymentType } from '../../payment-rule/enums/payment-type.enum';

// payment-processing/types/real-time-calculation.types.ts
export interface RealTimeWorkerPayment {
  workerId: number;
  workerName: string;
  amount: number;
  currency: string;
  roleInSale: 'MAIN_SELLER' | 'PUBLICIST' | 'OTHER';
  calculationDetails: {
    baseAmount: number; // Monto base antes de distribución
    distributedAmount?: number; // Monto después de distribución
    totalWorkers?: number; // Total de workers entre los que se distribuyó
    percentage?: number; // Porcentaje aplicado (para PERCENTAGE)
    rangeUsed?: string; // Rango aplicado (para PRICE_RANGE)
    productCount?: number; // Cantidad de productos (para SALE_QUANTITY)
    [key: string]: any; // Otros detalles específicos
  };
  accumulatorUpdate?: {
    productCounter?: number;
    salesTotal?: number;
    accumulatedAmount?: number;
    accumulatedCurrency?: number;
  };
}

export interface RealTimeCalculationResult {
  workerPayments: RealTimeWorkerPayment[];
  ruleSummary: {
    ruleId: number;
    ruleName: string;
    ruleType: PaymentType;
    totalAmount: number; // Suma total de todos los pagos
    totalWorkers: number; // Total de workers que reciben pago
    distributeProfitsApplied: boolean;
    baseCalculation: {
      amount: number; // Monto total calculado antes de distribución
      currency: string;
    };
  };
}
