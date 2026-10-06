import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsDate,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsString,
  IsInt,
  IsPositive,
  ArrayMinSize,
  Length,
} from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';
import { CreateSecurityBaseInput } from '../../../../core/dtos/create-security-base.input';
import { Type } from 'class-transformer';
import { MakeSalePaymentInput } from './make-sale.input';

export class SaleDetailInput {
  @IsNumber()
  productId: number;

  // El inventario se lleva en unidades enteras.
  @IsInt()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  publicistIds?: number[];
}

export class CreateSaleInput extends CreateSecurityBaseInput {
  // Sin él vende el trabajador vinculado al usuario de la sesión.
  @IsOptional()
  @IsNumber()
  salesWorkerId?: number;

  @IsNumber()
  @IsOptional()
  customerId?: number;

  // La forma de pago real va en `payments`; se acepta por compatibilidad.
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  paymentDetails?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  invoiceNumber?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleDetailInput)
  details: SaleDetailInput[];

  // NUEVOS CAMPOS DE MENSAJERÍA
  @IsOptional()
  @IsBoolean()
  hasDelivery?: boolean;

  @IsOptional()
  @IsNumber()
  deliveryWorkerId?: number;

  @IsOptional()
  @IsString()
  deliveryNotes?: string;

  // Con pagos la venta se crea ya cobrada, en la misma transacción.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MakeSalePaymentInput)
  payments?: MakeSalePaymentInput[];

  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;

  @IsOptional()
  @IsDate()
  customDate?: Date;
}
