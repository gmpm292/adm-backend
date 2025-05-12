import {
  IsString,
  IsOptional,
  IsEmail,
  IsPhoneNumber,
  Length,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

export class CreateCustomerInput extends CreateSecurityBaseInput {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsOptional()
  additionalInfo?: Record<string, unknown>;

  @IsOptional()
  userId?: number; // For linking existing user
}
