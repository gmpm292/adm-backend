import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsNumberString,
  IsString,
} from 'class-validator';
import { BaseFiltersValidator } from '../../../../core/filters-validator/base-filters.validator';
import { SaleStatus } from '../enums/sale-status.enum';

export class SaleFiltersValidator extends BaseFiltersValidator {
  @IsBooleanString()
  hasDelivery: string;

  @IsBooleanString()
  isConfirmed: string;

  @IsEnum(SaleStatus)
  saleStatus: string;

  @IsString()
  invoiceNumber: string;

  @IsDateString()
  effectiveDate: string;

  @IsNumberString()
  totalAmount: string;

  @IsString()
  totalAmountCurrency: string;

  @IsString()
  'customer.fullName'?: string;

  @IsNumberString()
  'customer.id'?: string;

  @IsNumberString()
  'salesWorker.id'?: string;

  @IsNumberString()
  'deliveryWorker.id'?: string;
}
