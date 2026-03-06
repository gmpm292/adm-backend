import {
  IsString,
  IsOptional,
  Length,
  IsNumber,
  Min,
  IsBoolean,
  IsInt,
  IsPositive,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * DTO for creating a new material cost.
 * Example: { name: "Gold", unitOfMeasureId: 1, costPrice: 65.50, currencyId: 1 }
 */
export class CreateMaterialCostInput extends CreateSecurityBaseInput {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @IsInt()
  @IsPositive()
  unitOfMeasureId: number;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsInt()
  @IsPositive()
  currencyId: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
