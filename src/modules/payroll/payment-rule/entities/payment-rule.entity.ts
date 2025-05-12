import { Entity, Column } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { PaymentType } from '../enums/payment-type.enum';
import { WorkerType } from '../../worker/enums/worker-type.enum';
import { Conditions } from '../types/conditions.type';

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

  @Column({ type: 'enum', enum: WorkerType, nullable: true })
  workerType?: WorkerType; // Specific worker type this rule applies to.

  @Column({ type: 'jsonb' })
  conditions: Conditions;
}
