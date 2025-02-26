import { IsString } from 'class-validator';

export class CreateRoleGuardInput {
  @IsString()
  public queryOrEndPointURL: string;

  
}
