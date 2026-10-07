import {
  IsInt,
  IsString,
  IsIn,
  Min,
  IsBoolean,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * DTO for creating a new inventory movement record
 * Example: {
 *   inventoryId: 1,
 *   type: "IN",
 *   quantity: 100,
 *   reason: "PURCHASE",
 *   referenceId: "Factura 0045"
 * }
 */
export class CreateInventoryMovementInput {
  @IsInt()
  inventoryId: number;

  @IsString()
  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  reason: string;

  @ValidateIf((o: CreateInventoryMovementInput) => o.isReservation ?? false)
  @IsUUID()
  reservationId?: string; // UUID para agrupar movimientos relacionados

  @IsBoolean()
  @IsOptional()
  isReservation?: boolean = false; // Default false si no se especifica

  // La venta que lo causó o, si se registra a mano, una nota (factura...)
  @IsString()
  @IsOptional()
  @MaxLength(255)
  referenceId?: string;
}
