import { IsString, IsOptional, Length, IsBoolean, IsIn } from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * DTO for creating a new unit of measure.
 * Example: { name: "Gram", symbol: "g", category: "weight" }
 */
export class CreateUnitOfMeasureInput extends CreateSecurityBaseInput {
  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Length(1, 10)
  symbol: string;

  @IsString()
  @IsOptional()
  @IsIn(
    [
      'weight',
      'volume',
      'length',
      'area',
      'time',
      'count',
      'energy',
      'power',
      'pressure',
      'temperature',
      'speed',
      'density',
      'other',
    ],
    { message: 'Category must be a valid unit category' },
  )
  category?: string;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
