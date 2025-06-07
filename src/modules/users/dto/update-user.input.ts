import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../../core/enums/role.enum';
import { CreateSecurityBaseInput } from '../../../core/dtos/create-security-base.input';

export class UpdateUserInput extends CreateSecurityBaseInput {
  @IsInt()
  @IsPositive()
  public id: number;

  // Only used in Typescript. From graphql is not allowed update.
  @IsOptional()
  public confirmationToken?: string;

  // Only used in Typescript. From graphql is not allowed update password using input UpdateUserInput
  @IsOptional()
  public password?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber()
  mobile?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = false;

  @IsOptional()
  @IsEnum(Role, { each: true })
  @ArrayNotEmpty()
  @ArrayMaxSize(1)
  role?: Role[];
}
