import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';
import { EntityStatus } from '../../../core/enums/entity-status.enum';

export class CreateScopedAccessInput {
  @IsPositive()
  @IsInt()
  businessId: number;

  @IsPositive()
  @IsInt()
  roleGuardId: number;

  @IsArray()
  @IsEnum(ScopedAccessEnum, { each: true })
  accessLevels: ScopedAccessEnum[];

  @IsOptional()
  @IsEnum(EntityStatus)
  entityStatus?: EntityStatus;
}
