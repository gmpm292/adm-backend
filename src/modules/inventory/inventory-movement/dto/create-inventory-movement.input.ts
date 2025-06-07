import {
  IsInt,
  IsString,
  IsIn,
  Min,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * DTO for creating a new inventory movement record
 * Example: {
 *   inventoryId: 1,
 *   userId: 5,
 *   type: "OUT",
 *   quantity: 100,
 *   reason: "SALE_RESERVATION",
 *   isReservation: true,
 *   reservationId: "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
 *   referenceId: "sale-123"
 * }
 */
export class CreateInventoryMovementInput extends CreateSecurityBaseInput {
  @IsInt()
  inventoryId: number;

  // @IsInt()
  // userId: number;

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

  @IsString()
  @IsOptional()
  referenceId?: string; // ID de la venta, orden, etc. que causó la reserva
}
