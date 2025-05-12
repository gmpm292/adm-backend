import { Entity, Column } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';

@Entity('py_currencies')
export class Currency extends SecurityBaseEntity {
  @Column({ type: 'varchar', length: 3, unique: true })
  code: string; // CUP, MLC, USD

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  symbol: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  exchangeRateToCUP: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
