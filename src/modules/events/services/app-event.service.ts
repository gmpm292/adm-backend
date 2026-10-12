/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Inject, Injectable } from '@nestjs/common';

import { RedisPubSub } from 'graphql-redis-subscriptions';
import { AppEvent } from '../types/app-event.type';
import { AppLoggerService } from '../../../common/logger/logger.service';
import { REDIS_PUB_SUB_TOKEN } from '../../../common/graphql/pubsub/pubsub.module';

/** Eventos en tiempo real para el frontend (suscripción `appEvents`). */
@Injectable()
export class AppEventService {
  constructor(
    private logger: AppLoggerService,
    @Inject(REDIS_PUB_SUB_TOKEN) private readonly pubSub: RedisPubSub,
  ) {}

  /**
   * Publica el evento sin esperar. `notify` lista los destinatarios: ids de
   * usuario o nombres de rol. Un fallo solo se registra como aviso.
   */
  public publish(appEvent: AppEvent) {
    const appEvents = appEvent;

    this.pubSub.publish('appEvents', { appEvents }).catch((error) =>
      this.logger.warn(
        `Some error happen when publish event.
           ${JSON.stringify(appEvent)}`,
        error,
      ),
    );
  }

  /* public async publishNotification(id: number) {
    const { message, notificationLogs } =
      await this.notificationLService.findOne(id);
    const notify = notificationLogs.map((n) => String(n.user.id));
    this.publish({ message, notify });
  } */
}
