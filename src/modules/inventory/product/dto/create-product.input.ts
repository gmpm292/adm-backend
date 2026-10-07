import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsObject,
  Length,
  IsArray,
  ArrayNotEmpty,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class FixedPriceDto {
  @IsString()
  @Length(3, 3)
  currency: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class BulkDiscountDto {
  @IsInt()
  @Min(1)
  minQty: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  discount: number;

  @IsArray()
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  applicableCurrencies: string[];
}

export class SaleRulesDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  minQuantity?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxQuantity?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BulkDiscountDto)
  bulkDiscounts?: BulkDiscountDto[];
}

export class PricingConfigDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  acceptedCurrencies: string[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FixedPriceDto)
  fixedPrices?: FixedPriceDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRateMargin?: number;

  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  decimalPlaces?: number;
}

export class CreateProductInput extends CreateSecurityBaseInput {
  @IsInt()
  categoryId: number;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsInt()
  unitOfMeasureId: number;

  @IsInt()
  @IsOptional()
  materialCostId?: number;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsString()
  @Length(3, 3)
  costCurrency: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsString()
  @Length(3, 3)
  baseCurrency: string;

  // Pares característica/valor: { talla: 'XL', color: 'Rojo' }
  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @Length(0, 100)
  warranty?: string;

  @ValidateNested()
  @Type(() => PricingConfigDto)
  pricingConfig: PricingConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SaleRulesDto)
  saleRules?: SaleRulesDto;
}
