import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { IsPhone } from '../../../core/validations/phone.validator';

export class CreateFirstUserInput {
  @IsEmail()
  email: string;

  @IsPhone()
  mobile: string;

  @IsString()
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  newPassword: string;
}
