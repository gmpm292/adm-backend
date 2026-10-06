import { IsEmail, IsString, MinLength } from 'class-validator';

export class ChangePasswordByEmailInput {
  @IsEmail()
  public email: string;

  @IsString()
  @MinLength(8)
  public newPassword: string;
}
