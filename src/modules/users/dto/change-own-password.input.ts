import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangeOwnPasswordInput {
  @IsString()
  @IsNotEmpty()
  public currentPassword: string;

  @IsString()
  @MinLength(8)
  public newPassword: string;
}
