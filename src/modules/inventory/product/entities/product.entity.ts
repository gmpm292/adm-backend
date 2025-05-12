import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Category } from '../../category/entities/category.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';
import { SaleDetail } from '../../../sales/sale-detail/entities/sale-detail.entity';

/**
 * Description: Items sold or managed in the system.
 */
@Entity('in_products')
export class Product extends SecurityBaseEntity {
  @ManyToOne(() => Category, (category) => category.id)
  category: Category;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  unitOfMeasure: string; // e.g., grams, units

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  costPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salePrice: number;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, unknown>; // e.g., { size: 'XL', color: 'Red' }

  @Column({ type: 'varchar', length: 100, nullable: true })
  warranty?: string; // Product warranty (e.g., "2 years")

  @OneToMany(() => Inventory, (inventory) => inventory.product)
  inventories: Inventory[];

  @OneToMany(() => Inventory, (inventory) => inventory.product)
  saleDetails: SaleDetail[];
}
