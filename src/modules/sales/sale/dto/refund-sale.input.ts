import { IsNumber, IsOptional, IsArray } from 'class-validator';

export class RefundSaleInput {
  @IsOptional()
  @IsNumber()
  saleId?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  saleDetailIds?: number[];
}
