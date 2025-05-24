/**
 * Tipo que representa una opción de pago específica para una moneda
 */
export type PaymentOption = {
  /** Código de la moneda (ej: "USD", "EUR") */
  currency: string;

  /** Precio por unidad en esta moneda */
  unitPrice: number;

  /** Precio total (unitPrice * cantidad) */
  total: number;

  /** Indica si es un precio fijo o calculado por conversión */
  isFixedPrice: boolean;

  /**
   * Tasa de cambio utilizada (solo aplica para precios calculados)
   * @optional
   */
  exchangeRate?: number;
};
