import { Entity, Column, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Sale } from '../../sale/entities/sale.entity';
import { Product } from '../../../inventory/product/entities/product.entity';
import { ProductPaymentOptions } from '../../../inventory/product/types/product-payment-options.type';
import { Worker } from '../../../payroll/worker/entities/worker.entity';

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

  // @Column({ type: 'decimal', precision: 12, scale: 2 })
  // unitPrice: number;

  // @Column({ type: 'decimal', precision: 12, scale: 2 })
  // subtotal: number;

  // @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  // discountPercentage?: number;

  @Column({ type: 'jsonb', nullable: true })
  productSnapshot?: Record<string, unknown>; // Stores product info at time of sale

  @Column({ type: 'jsonb', nullable: true })
  productPaymentOptions: ProductPaymentOptions; // Tipo que representa las opciones de pago calculadas para un producto

  @Column({ nullable: false })
  reservationId: string; //Se define cuando es validado y reservado un stock de un producto.

  @Column({ type: 'boolean', default: false })
  isConfirmed?: boolean;

  @ManyToMany(() => Worker, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinTable({
    name: 'sl_sale_details_publicists', // Nombre de la tabla intermedia
    joinColumn: {
      name: 'sale_details_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'publicist_id',
      referencedColumnName: 'id',
    },
  })
  publicists?: Worker[];
}
