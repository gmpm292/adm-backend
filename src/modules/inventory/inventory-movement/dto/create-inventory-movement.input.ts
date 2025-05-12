import { IsInt, IsString, IsIn, Min } from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * DTO for creating a new inventory movement record
 * Example: {
 *   inventoryId: 1,
 *   userId: 5,
 *   type: "IN",
 *   quantity: 100,
 *   reason: "PURCHASE"
 * }
 */
export class CreateInventoryMovementInput extends CreateSecurityBaseInput {
  @IsInt()
  inventoryId: number;

  @IsInt()
  userId: number;

  @IsString()
  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  reason: string;
}
