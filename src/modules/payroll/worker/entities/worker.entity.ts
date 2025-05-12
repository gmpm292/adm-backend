import { Entity, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { User } from '../../../users/entities/user.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { WorkerType } from '../enums/worker-type.enum';
import { Role } from '../../../../core/enums/role.enum';

@Entity('py_workers')
export class Worker extends SecurityBaseEntity {
  @OneToOne(() => User)
  @JoinColumn()
  user?: User;

  @Column({ type: 'text', default: Role.AGENT })
  role: Role;

  @Column({ type: 'varchar', length: 20 })
  workerType: WorkerType;

  @ManyToOne(() => PaymentRule, { nullable: true })
  paymentRule?: PaymentRule;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  baseSalary: number;

  @Column({ type: 'jsonb', nullable: true })
  customPaymentSettings?: Record<string, unknown>;
}
