import {
  IsString,
  IsNumber,
  IsOptional,
  IsJSON,
  Length,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class FixedPriceDto {
  @IsString()
  @Length(3, 3)
  currency: string;

  @IsNumber()
  amount: number;
}

export class BulkDiscountDto {
  @IsNumber()
  minQty: number;

  @IsNumber()
  discount: number;

  @IsArray()
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  applicableCurrencies: string[];
}

export class SaleRulesDto {
  @IsNumber()
  @IsOptional()
  minQuantity?: number;

  @IsNumber()
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
  @IsString({ each: true })
  @Length(3, 3, { each: true })
  acceptedCurrencies: string[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FixedPriceDto)
  fixedPrices?: FixedPriceDto[];

  @IsNumber()
  @IsOptional()
  exchangeRateMargin?: number;

  @IsNumber()
  @IsOptional()
  decimalPlaces?: number;
}

export class CreateProductInput extends CreateSecurityBaseInput {
  @IsNumber()
  categoryId: number;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @Length(1, 50)
  unitOfMeasure: string;

  @IsNumber()
  costPrice: number;

  @IsString()
  @Length(3, 3)
  costCurrency: string;

  @IsNumber()
  basePrice: number;

  @IsString()
  @Length(3, 3)
  baseCurrency: string;

  @IsJSON()
  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  warranty?: string;

  @ValidateNested()
  @Type(() => PricingConfigDto)
  pricingConfig: PricingConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SaleRulesDto)
  saleRules?: SaleRulesDto;
}
