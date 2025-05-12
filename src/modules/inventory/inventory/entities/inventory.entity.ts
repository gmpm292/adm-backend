import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { InventoryMovement } from '../../inventory-movement/entities/inventory-movement.entity';

/**
 * Description: Stock records per office/location.
 */
@Entity('in_inventories')
export class Inventory extends SecurityBaseEntity {
  @ManyToOne(() => Product, (product) => product.id)
  product: Product;

  //   @ManyToOne(() => Office, (office) => office.id)
  //   office: Office;

  @Column({ type: 'integer' })
  currentStock: number;

  @Column({ type: 'integer', nullable: true })
  minStock?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location?: string;

  @OneToMany(() => InventoryMovement, (movement) => movement.inventory)
  inventoryMovements?: InventoryMovement[];
}
