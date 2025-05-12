import { PartialType } from '@nestjs/mapped-types';
import { CreateProductInput } from './create-product.input';
import { IsNumber } from 'class-validator';

/**
 * DTO for updating an existing product.
 * Inherits all fields from CreateProductInput but makes them optional.
 * Requires `id` for identification.
 */
export class UpdateProductInput extends PartialType(CreateProductInput) {
  @IsNumber()
  id: number;
}
