import { PaymentOption } from './payment-option.type';

/**
 * Tipo que representa las opciones de pago calculadas para un producto
 */
export type ProductPaymentOptions = {
  /** Precio base del producto en su moneda original */
  basePrice: number;

  /** Moneda base del producto (ej: "USD", "EUR") */
  baseCurrency: string;

  /** Listado de opciones de pago disponibles */
  paymentOptions: Array<PaymentOption>;

  /** Cantidad solicitada del producto */
  quantity: number;

  /** Cantidad mínima permitida (si aplica) */
  minQuantity?: number;

  /** Cantidad máxima permitida (si aplica) */
  maxQuantity?: number;
};
