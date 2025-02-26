import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationResolver } from './resolvers/notification.resolver';
import { NotificationService } from './services/notification.service';

import { NotificationLogService } from './services/notification-log.service';
import { NotificationAccessLevelService } from './services/notification-access-level.service';
import { NotificationLog } from './entities/notification-log.entity';
import { User } from '../users/entities/user.entity';
import { AppEventModule } from '../events/app-event.module';
import { Notification } from './entities/notification.entity';
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationLog, User]),
    AppEventModule,
  ],
  providers: [
    //NotificationResolver,
    NotificationService,
    NotificationLogService,
    NotificationAccessLevelService,
  ],
  exports: [
    NotificationService,
    NotificationLogService,
    NotificationAccessLevelService,
  ],
})
export class NotificationModule {}
