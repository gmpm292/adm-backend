import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Role } from '../../../core/enums/role.enum';

export class UpdateRoleGuardInput {
  @IsInt()
  @IsPositive()
  id: number;

  @IsOptional()
  @IsEnum(Role, { each: true })
  public roles?: Role[];

  @IsOptional()
  @IsString()
  public description?: string;
}
