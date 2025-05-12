import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateBusinessInput {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;
}
