import { IsString } from 'class-validator';

export class CheckConfirmationTokenInput {
  @IsString()
  public confirmationToken: string;
}
