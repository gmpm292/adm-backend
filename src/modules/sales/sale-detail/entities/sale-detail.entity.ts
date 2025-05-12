import { Entity, Column, ManyToOne } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Sale } from '../../sale/entities/sale.entity';
import { Product } from '../../../inventory/product/entities/product.entity';

/**
 * Description: Products sold in a transaction.
 */
@Entity('sl_sale_details')
export class SaleDetail extends SecurityBaseEntity {
  @ManyToOne(() => Sale, (sale) => sale.details)
  sale: Sale;

  @ManyToOne(() => Product, (product) => product.saleDetails)
  product: Product;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercentage?: number;

  @Column({ type: 'jsonb', nullable: true })
  productSnapshot?: Record<string, unknown>; // Stores product info at time of sale
}
