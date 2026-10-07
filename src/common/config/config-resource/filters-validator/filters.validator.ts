import { IsIn, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { ConfigCategory } from '../enums/config-category.enum';
import { ConfigStatus } from '../enums/config-status.enum';
import { ConfigVisibility } from '../enums/config-visibility.enum';

export class FiltersValidator extends BaseFiltersValidator {
  @IsString()
  group: string;

  @IsString()
  description: string;

  @IsIn(Object.values(ConfigCategory))
  category: string;

  @IsIn(Object.values(ConfigStatus))
  configStatus: string;

  @IsIn(Object.values(ConfigVisibility))
  configVisibility: string;
}
