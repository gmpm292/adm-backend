import { IsString, IsOptional, Length } from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * DTO for creating a new product category.
 * Example: { name: "Electronics", description: "Devices and gadgets" }
 */
export class CreateCategoryInput extends CreateSecurityBaseInput {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
