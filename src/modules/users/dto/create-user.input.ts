import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { IsPhone } from '../../../core/validations/phone.validator';
import { Role } from '../../../core/enums/role.enum';
import { CreateSecurityBaseInput } from '../../../core/dtos/create-security-base.input';

export class CreateUserInput extends CreateSecurityBaseInput {
  @IsString()
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  lastName?: string;

  @IsEmail()
  email: string;

  @IsPhone()
  mobile: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean = false;

  @IsEnum(Role, { each: true })
  @ArrayNotEmpty()
  @ArrayMaxSize(1)
  role: Role[];
}
