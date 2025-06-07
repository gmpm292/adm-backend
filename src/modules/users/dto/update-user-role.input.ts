import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsEnum,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Role } from '../../../core/enums/role.enum';
import { CreateSecurityBaseInput } from '../../../core/dtos/create-security-base.input';

export class UpdateUserRoleInput extends CreateSecurityBaseInput {
  @IsInt()
  @IsPositive()
  public id: number;

  @IsEnum(Role, { each: true })
  @ArrayNotEmpty()
  @ArrayMaxSize(1)
  role: Role[];
}
