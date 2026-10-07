import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';

export class CreateScopedAccessInput {
  @IsPositive()
  @IsInt()
  businessId: number;

  @IsPositive()
  @IsInt()
  roleGuardId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ScopedAccessEnum, { each: true })
  accessLevels: ScopedAccessEnum[];

  @IsOptional()
  @IsIn(['ENABLED', 'DISABLED'])
  entityStatus?: string;
}
