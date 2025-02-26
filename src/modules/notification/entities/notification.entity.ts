import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { IsString } from 'class-validator';

import { NotificationLog } from './notification-log.entity';
import { BaseEntity } from '../../../core/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
export class Notification extends BaseEntity {
  @IsString()
  @Column()
  tipo: string;

  @IsString()
  @Column()
  titulo: string;

  @IsString()
  @Column()
  message: string;

  @IsString()
  @Column({ default: 'draft' })
  status: string;

  @OneToMany(
    () => NotificationLog,
    (notificationLog) => notificationLog.notification,
  )
  notificationLogs: NotificationLog[];

  @ManyToOne(() => User, (user) => user.id, { eager: false })
  @JoinColumn()
  createdBy?: User;

  @ManyToOne(() => User, (user) => user.id, { eager: false })
  @JoinColumn()
  sentBy?: User;

  @Column({
    type: 'timestamp without time zone',
    nullable: true,
    default: null,
  })
  sentAt?: Date;

  @Column()
  @Column('jsonb', { nullable: true, default: null })
  metadata: Record<string, unknown>;
}
