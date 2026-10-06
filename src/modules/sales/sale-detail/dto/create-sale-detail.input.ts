import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateSaleDetailInput extends CreateSecurityBaseInput {
  @IsNumber()
  saleId: number;

  @IsNumber()
  productId: number;

  // El inventario se lleva en unidades enteras.
  @IsInt()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  publicistIds?: number[];

  // @IsNumber()
  // unitPrice: number;

  // @IsNumber()
  // @IsOptional()
  // discountPercentage?: number;
}
