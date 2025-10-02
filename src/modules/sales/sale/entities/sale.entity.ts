import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Customer } from '../../customer/entities/customer.entity';
import { SaleDetail } from '../../sale-detail/entities/sale-detail.entity';
import { PaymentMethod } from '../enums/payment-method.enum';
import { Worker } from '../../../payroll/worker/entities/worker.entity';

/**
 * Description: Sales transactions recording.
 */
@Entity('sl_sales')
export class Sale extends SecurityBaseEntity {
  @ManyToOne(() => Worker)
  salesWorker: Worker; // Salesperson

  @ManyToOne(() => Customer, (customer) => customer.sales, { nullable: true })
  customer?: Customer; // Nullable for anonymous sales

  @Column({ type: 'jsonb', nullable: false })
  payments?: Array<{
    amount: number;
    currency: string; // Código ISO 4217 (USD, EUR, CUP, etc.)
    paymentMethod: PaymentMethod;
    paymentDetails?: Record<string, unknown>; //Almacena datos flexibles del pago. Tarjetas (últimos 4 dígitos, banco), transferencias (referencia), etc.
  }>;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalAmount?: number; // Ahora es un campo calculado

  @Column({ type: 'varchar', length: 3, nullable: true })
  totalAmountCurrency?: string; // Moneda base para reportes

  @Column({ type: 'time without time zone', nullable: true })
  effectiveDate?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  invoiceNumber?: string; //Identificador único de la factura. Ejemplo: "F2025-0001" (Formato común: [Tipo][Año]-[Secuencial]).

  @OneToMany(() => SaleDetail, (detail) => detail.sale)
  details?: SaleDetail[];
}
