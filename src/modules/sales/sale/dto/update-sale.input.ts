import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleInput } from './create-sale.input';
import { IsDate, IsNumber } from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';

export class UpdateSaleInput extends PartialType(CreateSaleInput) {
  @IsNumber()
  id: number;

  @IsDate()
  effectiveDate: Date;

  payments: Array<{
    amount: number;
    currency: string; // Código ISO 4217 (USD, EUR, CUP, etc.)
    paymentMethod: PaymentMethod;
    paymentDetails?: Record<string, unknown>; //Almacena datos flexibles del pago. Tarjetas (últimos 4 dígitos, banco), transferencias (referencia), etc.
  }>;

  totalAmount: number; // Ahora es un campo calculado

  totalAmountCurrency: string; // Moneda base para reportes
}
