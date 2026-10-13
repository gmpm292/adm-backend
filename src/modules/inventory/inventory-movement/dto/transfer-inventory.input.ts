import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Traslado de existencias de un inventario a otro del mismo producto y la
 * misma empresa. Example: {
 *   fromInventoryId: 3,
 *   toInventoryId: 7,
 *   quantity: 20,
 *   note: "Reposición de la vitrina"
 * }
 */
export class TransferInventoryInput {
  @IsInt()
  fromInventoryId: number;

  @IsInt()
  toInventoryId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  note?: string;
}
