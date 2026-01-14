import { IsInt, Min } from 'class-validator';

export class ProcessSalePaymentInput {
  @IsInt()
  @Min(1)
  saleId: number;

  // @IsOptional()
  // @IsInt()
  // @Min(1)
  // payrollPeriodId?: number; // Si no se especifica, se usa el período actual
}
