import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Role } from '../../../core/enums/role.enum';

export class UpdateRoleGuardInput {
  @IsInt()
  @IsPositive()
  id: number;

  /** Sustituye los `@Roles` del código; `null` vuelve a ellos */
  @IsOptional()
  @IsEnum(Role, { each: true })
  public roles?: Role[] | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public description?: string;
}
