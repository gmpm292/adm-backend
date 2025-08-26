import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryMovementInput } from './create-inventory-movement.input';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * DTO for updating an existing inventory movement record
 * All fields are optional except id
 */
export class UpdateInventoryMovementInput extends PartialType(
  CreateInventoryMovementInput,
) {
  @IsInt()
  id: number;

  // @IsOptional()
  // @IsInt()
  // inventoryId: number;

  @IsOptional()
  @IsString()
  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  reason: string;

  @IsOptional()
  @ValidateIf((o: CreateInventoryMovementInput) => o.isReservation ?? false)
  @IsUUID()
  reservationId?: string; // UUID para agrupar movimientos relacionados

  @IsOptional()
  @IsBoolean()
  isReservation?: boolean = false; // Default false si no se especifica

  @IsOptional()
  @IsString()
  referenceId?: string; // ID de la venta, orden, etc. que causó la reserva
}
