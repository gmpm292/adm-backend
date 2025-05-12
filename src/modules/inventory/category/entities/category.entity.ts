import { Entity, Column, OneToMany } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Product } from '../../product/entities/product.entity';

/**
 * Description: Classification of products (e.g., Clothing, Electronics).
 * Stores product categories for organization and filtering.
 */
@Entity('in_categories')
export class Category extends SecurityBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
