import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { Role } from '../../../core/enums/role.enum';

export class UpdateUserRoleInput {
  @IsInt()
  @IsPositive()
  public id: number;

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
}
