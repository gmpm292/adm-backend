import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Lo que se edita de un inventario. Las existencias no: cambian solo con
 * movimientos. `null` vacía el dato.
 */
export class UpdateInventoryInput {
  @IsInt()
  id: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string | null;
}
