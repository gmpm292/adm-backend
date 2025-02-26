import { IsEmail } from 'class-validator';

export class RequestPasswordChangeInput {
  @IsEmail()
  public email: string;
}
