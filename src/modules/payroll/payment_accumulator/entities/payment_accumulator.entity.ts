import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Worker } from '../../worker/entities/worker.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';

@Entity('py_payment_accumulators')
export class PaymentAccumulator extends SecurityBaseEntity {
  @ManyToOne(() => Worker, { nullable: false })
  @JoinColumn()
  worker: Worker;

  @ManyToOne(() => PaymentRule, { nullable: false })
  @JoinColumn()
  paymentRule: PaymentRule;

  @ManyToOne(() => PayrollPeriod, { nullable: false })
  @JoinColumn()
  payrollPeriod: PayrollPeriod;

  @Column({ type: 'int', default: 0 })
  productCounter: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  salesTotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  accumulatedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  accumulatedCurrency: number;

  @Column({ type: 'json', nullable: true })
  metadata: any;
}
