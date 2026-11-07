/**
 * Motivos que se pueden registrar a mano desde la pantalla de movimientos.
 * Los demás (`INITIAL_INVENTORY`, `SALE_*`...) los genera el sistema al
 * crear un inventario o al vender, y no se aceptan desde fuera.
 */
export const MANUAL_MOVEMENT_REASONS: Record<'IN' | 'OUT', string[]> = {
  IN: ['PURCHASE', 'RETURN', 'TRANSFER', 'INVENTORY_ADJUSTMENT', 'OTHER'],
  OUT: ['LOSS', 'INTERNAL_USE', 'TRANSFER', 'INVENTORY_ADJUSTMENT', 'OTHER'],
};

/**
 * Motivos de una carga desde la hoja de inventario (`loadInventory`). Incluye
 * el inventario inicial: la hoja es la forma de hacer el primer conteo.
 */
export const LOAD_REASONS = [
  'INITIAL_INVENTORY',
  'PURCHASE',
  'RETURN',
  'INVENTORY_ADJUSTMENT',
  'OTHER',
];

/**
 * Motivo de los dos movimientos de un traslado entre inventarios
 * (`transferInventory` y los envíos entre oficinas, `sendInventory`).
 * `TRANSFER` queda para lo que entra o sale de fuera de la empresa.
 */
export const INVENTORY_TRANSFER_REASON = 'INVENTORY_TRANSFER';
