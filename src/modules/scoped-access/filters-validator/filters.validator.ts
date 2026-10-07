import { IsNumberString, IsOptional, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../core/filters-validator/base-filters.validator';

export class ScopedAccessFiltersValidator extends BaseFiltersValidator {
  @IsNumberString()
  @IsOptional()
  'business.id'?: string;

  @IsString()
  @IsOptional()
  'business.name'?: string;

  @IsNumberString()
  @IsOptional()
  'roleGuard.id'?: string;

  @IsString()
  @IsOptional()
  'roleGuard.queryOrEndPointURL'?: string;

  @IsString()
  @IsOptional()
  'roleGuard.type'?: string;

  @IsNumberString()
  @IsOptional()
  'entityStatus'?: string;
}
