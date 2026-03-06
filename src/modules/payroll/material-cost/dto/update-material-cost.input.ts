import { PartialType } from '@nestjs/mapped-types';
import { CreateMaterialCostInput } from './create-material-cost.input';
import { IsNumber, IsPositive } from 'class-validator';

/**
 * DTO for updating an existing material cost.
 * Inherits all fields from CreateMaterialCostInput but makes them optional.
 * Requires `id` for identification.
 */
export class UpdateMaterialCostInput extends PartialType(
  CreateMaterialCostInput,
) {
  @IsNumber()
  @IsPositive()
  id: number;
}
