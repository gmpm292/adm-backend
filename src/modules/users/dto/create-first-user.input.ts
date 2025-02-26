import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateFirstUserInput {
  @IsEmail()
  email: string;

  @IsPhoneNumber()
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
