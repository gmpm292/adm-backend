import { IsNumberString, IsOptional, IsEnum } from 'class-validator';
import { EntityStatus } from '../../../core/enums/entity-status.enum';
import { BaseFiltersValidator } from '../../../core/filters-validator/base-filters.validator';

export class ScopedAccessFiltersValidator extends BaseFiltersValidator {
  @IsNumberString()
  @IsOptional()
  'business.id'?: string;

  @IsNumberString()
  @IsOptional()
  'roleGuard.id'?: string;

  @IsEnum(EntityStatus)
  @IsOptional()
  'entityStatus'?: EntityStatus;
}
