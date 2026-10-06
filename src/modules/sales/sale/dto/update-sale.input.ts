import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';

/**
 * Datos generales de una venta. Sus productos se cambian con las mutaciones
 * de líneas y su cobro con `makeSale`.
 */
export class UpdateSaleInput extends CreateSecurityBaseInput {
  @IsNumber()
  id: number;

  @IsOptional()
  @IsNumber()
  salesWorkerId?: number;

  // `null` deja la venta sin cliente.
  @IsOptional()
  @IsNumber()
  customerId?: number | null;

  @IsOptional()
  paymentMethod?: string;

  @IsOptional()
  paymentDetails?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  invoiceNumber?: string;

  @IsOptional()
  @IsBoolean()
  hasDelivery?: boolean;

  // `null` desasigna al mensajero.
  @IsOptional()
  @IsNumber()
  deliveryWorkerId?: number | null;

  @IsOptional()
  @IsString()
  deliveryNotes?: string;
}
