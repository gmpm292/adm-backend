import { Entity, Column, ManyToOne } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Worker } from '../../worker/entities/worker.entity';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';
import { PaymentConcept } from '../enums/payment-concept.enum';

@Entity('py_worker_payments')
export class WorkerPayment extends SecurityBaseEntity {
  @ManyToOne(() => Worker)
  worker: Worker;

  @Column({ type: 'timestamp', nullable: true })
  paidDate?: Date; // Day it was paid. If null, it has not been carried out.

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string; // CUP, MLC, USD

  @Column({ type: 'decimal', precision: 12, scale: 6, nullable: true })
  exchangeRate?: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentConcept })
  paymentConcept: PaymentConcept;

  @ManyToOne(() => PayrollPeriod)
  payrollPeriod: PayrollPeriod;

  @Column({ type: 'jsonb', nullable: true })
  breakdown: {
    baseSalary?: number;
    commissions?: number;
    bonuses?: number;
    deductions?: number;
  };

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
