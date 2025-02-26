import { IsString } from 'class-validator';

export class ChangePasswordInput {
  @IsString()
  public confirmationToken: string;
  @IsString()
  public newPassword: string;
}
