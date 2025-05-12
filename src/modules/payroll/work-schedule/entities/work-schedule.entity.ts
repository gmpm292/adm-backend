import { Entity, Column } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';

@Entity('py_work_schedules')
export class WorkSchedule extends SecurityBaseEntity {
  //   @ManyToOne(() => Office)
  //   office: Office;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'jsonb' })
  workingDays: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
