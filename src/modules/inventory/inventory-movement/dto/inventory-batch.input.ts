import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOAD_REASONS } from '../enums/movement-reason';

/**
 * Una línea de la hoja: un inventario de la oficina o, si el producto aún
 * no tiene ninguno allí (solo al cargar), el producto.
 */
export class InventoryLineInput {
  @IsInt()
  @IsOptional()
  inventoryId?: number;

  @IsInt()
  @IsOptional()
  productId?: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * Entrada de varias líneas en una oficina. Example: {
 *   officeId: 2, reason: "PURCHASE", note: "Factura 0045",
 *   lines: [{ inventoryId: 7, quantity: 10 }, { productId: 18, quantity: 4 }]
 * }
 */
export class LoadInventoryInput {
  @IsInt()
  officeId: number;

  @IsString()
  @IsIn(LOAD_REASONS)
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  note?: string;

  @ValidateNested({ each: true })
  @Type(() => InventoryLineInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  lines: InventoryLineInput[];
}

/**
 * Envío de varias líneas de una oficina a otra de la misma empresa. Cada
 * línea es un inventario de la oficina de origen. Example: {
 *   fromOfficeId: 2, toOfficeId: 9, note: "Reposición semanal",
 *   lines: [{ inventoryId: 7, quantity: 5 }]
 * }
 */
export class SendInventoryInput {
  @IsInt()
  fromOfficeId: number;

  @IsInt()
  toOfficeId: number;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  note?: string;

  @ValidateNested({ each: true })
  @Type(() => InventoryLineInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  lines: InventoryLineInput[];
}
