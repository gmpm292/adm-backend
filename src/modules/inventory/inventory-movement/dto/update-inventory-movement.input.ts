import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryMovementInput } from './create-inventory-movement.input';
import { IsInt } from 'class-validator';

/**
 * DTO for updating an existing inventory movement record
 * All fields are optional except id
 */
export class UpdateInventoryMovementInput extends PartialType(
  CreateInventoryMovementInput,
) {
  @IsInt()
  id: number;
}
