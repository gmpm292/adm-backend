import {
  IsString,
  IsNumber,
  IsOptional,
  IsJSON,
  Length,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * DTO for creating a new product.
 * Example: {
 *   name: "Smartphone",
 *   unitOfMeasure: "units",
 *   costPrice: 499.99,
 *   salePrice: 699.99,
 *   categoryId: 1,
 *   warranty: "2 years",
 *   attributes: { color: "Black", storage: "128GB" }
 * }
 */
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

  @IsNumber()
  salePrice: number;

  @IsJSON()
  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  warranty?: string;
}
