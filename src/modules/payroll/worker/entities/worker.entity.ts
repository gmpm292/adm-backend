import { Entity, Column, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { User } from '../../../users/entities/user.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { WorkerType } from '../enums/worker-type.enum';
import { Role } from '../../../../core/enums/role.enum';

@Entity('py_workers')
export class Worker extends SecurityBaseEntity {
  @OneToOne(() => User, { nullable: true })
  @JoinColumn()
  user?: User;

  @Column({ type: 'varchar', length: 20 })
  workerType: WorkerType;

  @Column({ type: 'text', nullable: true })
  otherType?: string;

  @ManyToOne(() => PaymentRule, { nullable: true })
  paymentRule?: PaymentRule;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  baseSalary: number;

  @Column({ type: 'jsonb', nullable: true })
  customPaymentSettings?: Record<string, unknown>;

  // Campos temporales para creación de usuario
  @Column({ type: 'varchar', length: 50, nullable: true })
  tempFirstName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tempLastName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tempEmail?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tempPhone?: string;

  @Column({ type: 'text', array: true, default: [] })
  tempRole?: Role[];
}
