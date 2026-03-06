export enum SaleStatus {
  DRAFT = 'DRAFT', // Borrador, sin efectividad
  CONFIRMED = 'CONFIRMED', // Venta efectiva/completada
  CANCELLED = 'CANCELLED', // Cancelada
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', // Devolución parcial
  FULLY_REFUNDED = 'FULLY_REFUNDED', // Devolución total
}
