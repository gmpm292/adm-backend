import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { PaymentType } from '../enums/payment-type.enum';
import { WorkerType } from '../../worker/enums/worker-type.enum';
import { Conditions } from '../types/conditions.type';
import { Product } from '../../../inventory/product/entities/product.entity';
import { Category } from '../../../inventory/category/entities/category.entity';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { PaymentAccumulator } from '../../payment_accumulator/entities/payment_accumulator.entity';
import { Worker } from '../../worker/entities/worker.entity';
import { WorkerPayment } from '../../worker-payment/entities/worker-payment.entity';

@Entity('py_payment_rules')
export class PaymentRule extends SecurityBaseEntity {
  @Column({ type: 'enum', enum: PaymentType })
  paymentType: PaymentType; // PRICE_RANGE, FIXED_AMOUNT, PERCENTAGE, etc.

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => Worker, { nullable: true })
  @JoinTable({
    name: 'py_payment_rule_workers', // Nombre de la tabla intermedia
    joinColumn: {
      name: 'payment_rule_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'worker_id',
      referencedColumnName: 'id',
    },
  })
  specificWorkers?: Worker[];

  @Column({ type: 'enum', enum: WorkerType, nullable: true })
  workerType?: WorkerType; // Specific worker type this rule applies to.

  @Column({ type: 'text', nullable: true })
  otherType?: string;

  @ManyToOne(() => Product, (product) => product.paymentRules, {
    nullable: true,
  })
  product?: Product; // Relación con producto (puede ser null)

  @ManyToOne(() => Category, (category) => category.paymentRules, {
    nullable: true,
  })
  category?: Category; // Relación con categoría (puede ser null)

  @Column({ type: 'varchar', length: 3 })
  paymentCurrency: string; // "CUP", "MLC", "USD"

  @Column({ type: 'enum', enum: ScopedAccessEnum })
  scope: ScopedAccessEnum;

  @Column({ type: 'boolean', default: false })
  distributeProfits: boolean;

  @Column({ type: 'jsonb' })
  conditions: Conditions;

  // Relaciones inversas.
  @OneToMany(() => PaymentAccumulator, (accumulator) => accumulator.paymentRule)
  paymentAccumulators?: PaymentAccumulator[];

  @OneToMany(() => WorkerPayment, (workerPayment) => workerPayment.paymentRule)
  workerPayments?: WorkerPayment[];
}
