import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PriceRangeConditionInput {
  @IsNumber()
  min: number;

  @IsNumber()
  @IsOptional()
  max?: number | null;

  @IsString()
  @MaxLength(3)
  @MinLength(3)
  currency: string;

  @IsNumber()
  amount: number;
}
