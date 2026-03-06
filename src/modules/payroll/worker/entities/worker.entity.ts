import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { User } from '../../../users/entities/user.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { WorkerType } from '../enums/worker-type.enum';
import { Role } from '../../../../core/enums/role.enum';
import { Sale } from '../../../sales/sale/entities/sale.entity';
import { WorkerPayment } from '../../worker-payment/entities/worker-payment.entity';
import { PaymentAccumulator } from '../../payment_accumulator/entities/payment_accumulator.entity';
import { SaleDetail } from '../../../sales/sale-detail/entities/sale-detail.entity';

@Entity('py_workers')
export class Worker extends SecurityBaseEntity {
  @OneToOne(() => User, { nullable: true, eager: true })
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

  // Relaciones inversas.
  @OneToMany(() => Sale, (sale) => sale.salesWorker)
  sales?: Sale[];

  @ManyToMany(() => SaleDetail, (saleDetail) => saleDetail.publicists)
  saleDetailsAsPublicist?: SaleDetail[];

  @OneToMany(() => WorkerPayment, (payment) => payment.worker)
  payments?: WorkerPayment[];

  @OneToMany(() => PaymentAccumulator, (accumulator) => accumulator.worker)
  paymentAccumulators?: PaymentAccumulator[];
}
