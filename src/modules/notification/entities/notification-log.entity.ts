import { Column, Entity, ManyToOne } from 'typeorm';
import { IsBoolean } from 'class-validator';

import { Notification } from './notification.entity';
import { BaseEntity } from '../../../core/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('notifications-log')
export class NotificationLog extends BaseEntity {
  @IsBoolean()
  @Column()
  read: boolean;

  @IsBoolean()
  @Column()
  erased: boolean;

  @ManyToOne(
    () => Notification,
    (notification) => notification.notificationLogs,
  )
  notification: Notification;

  @ManyToOne(() => User, (user) => user.notificationLogs)
  user: User;
}
