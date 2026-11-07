import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductInput } from './create-product.input';

/**
 * Un producto por cada valor de una característica (Talla 1, 2, 3...): todos
 * con los mismos datos de `product`, y el inventario abierto en `officeIds`.
 */
export class CreateProductVariantsInput {
  @ValidateNested()
  @Type(() => CreateProductInput)
  product: CreateProductInput;

  // Lo que cambia entre ellos: Talla, Color, Medida...
  @IsString()
  @Length(1, 50)
  variantName: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  values: string[];

  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  officeIds?: number[];
}
