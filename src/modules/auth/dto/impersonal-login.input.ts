import { IsNumber, IsPositive } from 'class-validator';

export class ImpersonalLoginInput {
  @IsNumber()
  @IsPositive()
  public userId: number;

  @IsNumber()
  @IsPositive()
  public timeInSec: number;
}
