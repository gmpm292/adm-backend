import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { User } from '../../../users/entities/user.entity';
import { Sale } from '../../sale/entities/sale.entity';

/**
 * Description: Customer database for marketing purposes.
 * Maintains a one-to-one relationship with User for registered customers.
 */
@Entity('sl_customers')
export class Customer extends SecurityBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'integer', default: 0 })
  loyaltyPoints: number;

  @Column({ type: 'jsonb', nullable: true })
  additionalInfo?: Record<string, unknown>;

  @OneToOne(() => User, { nullable: true })
  @JoinColumn()
  user?: User; // Link to user account if registered

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];
}
