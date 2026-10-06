import { IsEnum, IsNumberString, IsString } from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { SaleDetailStatus } from '../enums/sale-detail-status.enum';

export class SaleDetailFiltersValidator extends BaseFiltersValidator {
  @IsNumberString()
  quantity: string;

  @IsEnum(SaleDetailStatus)
  saleDetailStatus: string;

  @IsString()
  'product.name'?: string;

  @IsNumberString()
  'product.id'?: string;

  @IsString()
  'sale.invoiceNumber'?: string;

  @IsNumberString()
  'sale.id'?: string;
}
