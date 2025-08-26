import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SecurityBaseEntity } from '../../../../core/entities/security-base.entity';
import { Worker } from '../../worker/entities/worker.entity';
import { WorkSchedule } from '../../work-schedule/entities/work-schedule.entity';
import { AttendanceStatus } from '../enums/attendance-status.enum';

@Entity('py_attendances')
export class Attendance extends SecurityBaseEntity {
  @ManyToOne(() => Worker, { eager: true })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @Column({ type: 'date' })
  attendanceDate: Date;

  @Column({ type: 'time', nullable: true, precision: 0 })
  checkInTime?: string;

  @Column({ type: 'time', nullable: true, precision: 0 })
  checkOutTime?: string;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.ABSENT,
  })
  status: AttendanceStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  hoursWorked: number;

  @Column({
    type: 'boolean',
    default: true,
    name: 'counts_for_profit_sharing',
  })
  countsForProfitSharing: boolean;

  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  @ManyToOne(() => WorkSchedule, { nullable: true })
  @JoinColumn({ name: 'work_schedule_id' })
  workSchedule?: WorkSchedule;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'boolean', default: false })
  isHoliday: boolean;
}
