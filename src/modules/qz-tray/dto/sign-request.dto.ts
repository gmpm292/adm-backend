import { IsString } from 'class-validator';

export class SignRequestDto {
  @IsString()
  request: string;
}
