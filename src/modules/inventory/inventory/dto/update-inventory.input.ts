import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryInput } from './create-inventory.input';
import { IsInt } from 'class-validator';

/**
 * DTO for updating an existing inventory record
 * All fields are optional except id
 */
export class UpdateInventoryInput extends PartialType(CreateInventoryInput) {
  @IsInt()
  id: number;
}
