import {
  IsString,
  IsOptional,
  IsEmail,
  IsPhoneNumber,
  Length,
  IsNumber,
  Min,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateCustomerInput extends CreateSecurityBaseInput {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @Length(1, 100)
  @IsOptional()
  lastName?: string;

  @IsString()
  @Length(1, 20)
  @IsOptional()
  ci?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  loyaltyPoints?: number;

  @IsOptional()
  additionalInfo?: Record<string, unknown>;

  @IsOptional()
  userId?: number; // For linking existing user
}
