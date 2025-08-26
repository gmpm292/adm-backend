import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for updating an existing inventory record
 * All fields are optional except id
 */
export class UpdateInventoryInput {
  @IsInt()
  id: number;

  // @IsOptional()
  // @IsInt()
  // productId: number;

  // @IsInt()
  // @Min(0)
  // currentStock: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsString()
  location?: string;
}
