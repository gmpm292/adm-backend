import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { User } from '../../../users/entities/user.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { SaleDetail } from '../../sale-detail/entities/sale-detail.entity';
import { PaymentMethod } from '../enums/payment-method.enum';

/**
 * Description: Sales transactions recording.
 */
@Entity('sl_sales')
export class Sale extends SecurityBaseEntity {
  // @ManyToOne(() => Office, (office) => office.sales)
  // office: Office;

  @ManyToOne(() => User)
  salesUser: User; // Salesperson

  @ManyToOne(() => Customer, (customer) => customer.sales, { nullable: true })
  customer?: Customer; // Nullable for anonymous sales

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod; // Enum: CASH, CARD, TRANSFER, etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  invoiceNumber?: string;

  @Column({ type: 'jsonb', nullable: true })
  paymentDetails?: Record<string, unknown>;

  @OneToMany(() => SaleDetail, (detail) => detail.sale)
  details: SaleDetail[];
}
