import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsPhone } from '../../../core/validations/phone.validator';

export class UpdateUserProfileInput {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  // An empty string clears the last name
  @ValidateIf((input: UpdateUserProfileInput) => Boolean(input.lastName))
  @IsString()
  @MinLength(3)
  lastName?: string;

  @IsOptional()
  @IsPhone()
  mobile?: string;
}
