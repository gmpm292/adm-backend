import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * DTO for creating a new inventory record
 * Example: {
 *   productId: 1,
 *   currentStock: 100,
 *   minStock: 10,
 *   location: "Warehouse A, Shelf 3"
 * }
 */
export class CreateInventoryInput extends CreateSecurityBaseInput {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(0)
  currentStock: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  minStock?: number;

  @IsString()
  @IsOptional()
  location?: string;
}
