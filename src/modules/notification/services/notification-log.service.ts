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

/**
 * Entradas de notificación por destinatario (leída, borrada). Acceso básico;
 * la lógica está en `NotificationService`.
 */
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
    return super.baseCreate({ data: notificationLog });
  }

  async find(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind({ options });
  }

  async findByUser(options?: ListOptions): Promise<ListSummary> {
    return await super.baseFind({ options });
  }

  async findOne(id: number): Promise<NotificationLog> {
    return super.baseFindOne({ id });
  }
}
