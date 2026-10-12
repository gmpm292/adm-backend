import { IsInt, Min } from 'class-validator';

export class ProcessSalePaymentInput {
  @IsInt()
  @Min(1)
  saleId: number;
}
