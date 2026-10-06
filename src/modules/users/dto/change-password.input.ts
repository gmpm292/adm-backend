import { IsString, MinLength } from 'class-validator';

export class ChangePasswordInput {
  @IsString()
  public confirmationToken: string;

  @IsString()
  @MinLength(8)
  public newPassword: string;
}
