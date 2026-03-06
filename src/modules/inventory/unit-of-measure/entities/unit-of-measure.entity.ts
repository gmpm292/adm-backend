import { Entity, Column, OneToMany } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Product } from '../../product/entities/product.entity';
import { MaterialCost } from '../../../payroll/material-cost/entities/material-cost.entity';

/**
 * Description: Represents a unit of measure (e.g., gram, kilogram, pound, liter).
 * Used across the system for consistent measurement units.
 */
@Entity('in_units_of_measure')
export class UnitOfMeasure extends SecurityBaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string; // e.g., "Gram", "Kilogram", "Pound", "Liter"

  @Column({ type: 'varchar', length: 10, unique: true })
  symbol: string; // e.g., "g", "kg", "lb", "L"

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string; // e.g., "weight", "volume", "length", "count"

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => MaterialCost, (materialCost) => materialCost.unitOfMeasure)
  materialCosts: MaterialCost[];

  @OneToMany(() => Product, (product) => product.unitOfMeasure)
  products: Product[];
}
