import { IsString, IsBooleanString, IsIn } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';

export class UnitOfMeasureFiltersValidator extends BaseFiltersValidator {
  @IsString()
  name?: string;

  @IsString()
  symbol?: string;

  @IsString()
  @IsIn([
    'peso',
    'volumen',
    'longitud',
    'área',
    'unidades',
    'tiempo',
    'energía',
    'potencia',
    'temperatura',
  ])
  category?: string;

  @IsBooleanString()
  isActive?: boolean;
}
