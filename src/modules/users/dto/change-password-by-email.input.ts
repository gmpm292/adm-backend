import { IsEmail, IsNotEmpty } from 'class-validator';

export class ChangePasswordByEmailInput {
  @IsEmail()
  public email: string;
  @IsNotEmpty()
  public newPassword: string;
}
