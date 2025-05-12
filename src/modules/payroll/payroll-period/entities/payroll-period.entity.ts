import { Entity, Column, OneToMany } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { WorkerPayment } from '../../worker-payment/entities/worker-payment.entity';

@Entity('py_payroll_periods')
export class PayrollPeriod extends SecurityBaseEntity {
  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'boolean', default: false })
  isClosed: boolean;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => WorkerPayment, (payment) => payment.payrollPeriod)
  payments: WorkerPayment[];
}
