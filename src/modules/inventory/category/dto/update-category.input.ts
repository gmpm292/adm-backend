import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryInput } from './create-category.input';
import { IsNumber } from 'class-validator';

/**
 * DTO for updating an existing product category.
 * Inherits all fields from CreateCategoryInput but makes them optional.
 * Requires `id` for identification.
 */
export class UpdateCategoryInput extends PartialType(CreateCategoryInput) {
  @IsNumber()
  id: number;
}
