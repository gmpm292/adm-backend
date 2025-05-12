import { Entity, Column, ManyToOne } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { User } from '../../../users/entities/user.entity';

/**
 * Description: Records of product inflows/outflows (e.g., purchases, sales, adjustments).
 */
@Entity('in_inventory_movements')
export class InventoryMovement extends SecurityBaseEntity {
  @ManyToOne(() => Inventory, (inventory) => inventory.id)
  inventory: Inventory;

  @ManyToOne(() => User, (user) => user.id)
  user: User; // Who registered the movement

  @Column({ type: 'varchar', length: 20 })
  type: 'IN' | 'OUT'; // IN (entry) or OUT (exit)

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'varchar', length: 50 })
  reason: string; // e.g., "PURCHASE", "SALE", "ADJUSTMENT"

  // @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  // timestamp: Date;
}
