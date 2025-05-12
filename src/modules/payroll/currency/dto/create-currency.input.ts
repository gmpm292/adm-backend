import {
  IsString,
  IsNumber,
  IsBoolean,
  Length,
  IsOptional,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateCurrencyInput extends CreateSecurityBaseInput {
  @IsString()
  @Length(3, 3)
  code: string; // CUP, MLC, USD

  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Length(1, 10)
  symbol: string;

  @IsNumber()
  exchangeRateToCUP: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
