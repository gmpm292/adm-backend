import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../../core/enums/role.enum';

export class CreateUserInput {
  @IsString()
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  lastName?: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber()
  mobile: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean = false;

  @IsEnum(Role, { each: true })
  @ArrayNotEmpty()
  @ArrayMaxSize(1)
  role: Role[];

  /*
   * Worker attributes.
   */
  @IsOptional()
  @IsPositive()
  @IsInt()
  officeId?: number;

  @IsOptional()
  @IsPositive()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsPositive()
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsPositive()
  @IsInt()
  leadId?: number;

  @IsString()
  @IsOptional()
  public zoomExt?: string;
}
