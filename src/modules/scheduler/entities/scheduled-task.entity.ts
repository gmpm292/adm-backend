import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../core/entities/base.entity';

@Entity()
export class ScheduledTask extends BaseEntity {
  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  handlerType: string; // Tipo de manejador (ej: 'VERIFY_POLICIES_EXPIRED')

  @Column()
  cronExpression: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastRun: Date | undefined;

  @Column({ type: 'timestamp', nullable: true })
  nextRun: Date | undefined;

  @Column({ default: false })
  isDefault: boolean; // Para identificar tareas por defecto
}
