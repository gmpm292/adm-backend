import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '../../../core/services/base.service';
import { NotificationLog } from '../entities/notification-log.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationLogService extends BaseService<NotificationLog> {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
  ) {
    super(notificationLogRepository);
  }

  async create(notificationLog: NotificationLog): Promise<NotificationLog> {
    return super.baseCreate(notificationLog);
  }

  async find(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind(options as ListOptions);
  }

  async findByUser(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind(options as ListOptions);
  }

  async findOne(id: number): Promise<NotificationLog> {
    return super.baseFindOne(id);
  }
}
