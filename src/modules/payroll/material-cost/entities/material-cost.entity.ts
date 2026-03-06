import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Product } from '../../../inventory/product/entities/product.entity';
import { UnitOfMeasure } from '../../../inventory/unit-of-measure/entities/unit-of-measure.entity';
import { Currency } from '../../currency/entities/currency.entity';

/**
 * Description: Represents the cost price of a material or element per unit of measure.
 * Used for calculating raw material costs in products.
 */
@Entity('material_costs')
export class MaterialCost extends SecurityBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g., "Gold", "Rice"

  @Column({ type: 'text', nullable: true })
  description?: string; // Optional detailed description

  @OneToMany(() => Product, (product) => product.materialCost)
  products?: Product[];

  @ManyToOne(() => UnitOfMeasure)
  @JoinColumn()
  unitOfMeasure: UnitOfMeasure;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  costPrice: number; // Cost per unitOfMeasure

  @ManyToOne(() => Currency)
  @JoinColumn()
  currency: Currency;

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Soft-enable/disable flag
}
