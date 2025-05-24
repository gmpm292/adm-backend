import { IsNumber, IsOptional } from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateSaleDetailInput extends CreateSecurityBaseInput {
  @IsNumber()
  saleId: number;

  @IsNumber()
  productId: number;

  @IsNumber()
  quantity: number;

  // @IsNumber()
  // unitPrice: number;

  // @IsNumber()
  // @IsOptional()
  // discountPercentage?: number;
}
