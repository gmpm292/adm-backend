import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

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
  @IsPhoneNumber()
  mobile?: string;
}
