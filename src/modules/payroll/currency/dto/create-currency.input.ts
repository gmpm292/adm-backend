import {
  IsPositive,
  Matches,
  IsString,
  IsNumber,
  IsBoolean,
  Length,
  IsOptional,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateCurrencyInput extends CreateSecurityBaseInput {
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'El código son tres letras, como USD' })
  code: string; // CUP, MLC, USD

  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Length(1, 10)
  symbol: string;

  @IsNumber()
  @IsPositive({ message: 'La tasa debe ser mayor que cero' })
  exchangeRateToCUP: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
