import { IsString, IsOptional, Length, IsBoolean, IsIn } from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';
import { UNIT_CATEGORIES } from '../unit-categories';

/**
 * DTO for creating a new unit of measure.
 * Example: { name: "Gramo", symbol: "g", category: "peso" }
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
  // Vacío: sin categoría
  @IsIn(UNIT_CATEGORIES, { message: 'La categoría no es válida' })
  category?: string;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
