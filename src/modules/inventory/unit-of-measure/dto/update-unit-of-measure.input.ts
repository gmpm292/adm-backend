import { PartialType } from '@nestjs/mapped-types';
import { CreateUnitOfMeasureInput } from './create-unit-of-measure.input';
import { IsNumber } from 'class-validator';

/**
 * DTO for updating an existing unit of measure.
 * Inherits all fields from CreateUnitOfMeasureInput but makes them optional.
 * Requires `id` for identification.
 */
export class UpdateUnitOfMeasureInput extends PartialType(
  CreateUnitOfMeasureInput,
) {
  @IsNumber()
  id: number;
}
