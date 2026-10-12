/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, UseGuards } from '@nestjs/common';
import { Resolver, Subscription } from '@nestjs/graphql';
import { RedisPubSub } from 'graphql-redis-subscriptions';

import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';

import { Role } from '../../../core/enums/role.enum';
import { REDIS_PUB_SUB_TOKEN } from '../../../common/graphql/pubsub/pubsub.module';
import { LoggerService } from '../../../common/logger';

// No está registrado en `AppEventModule`: la suscripción `appEvents` no
// tiene resolver activo (el frontend no la usa).
@Resolver('appEvent')
export class AppEventResolver {
  constructor(
    @Inject(REDIS_PUB_SUB_TOKEN) private readonly pubSub: RedisPubSub,
  ) {}

  @UseGuards(AccessTokenAuthGuard)
  @Subscription('appEvents', {
    filter(this: LoggerService, payload, variables, context) {
      const user = context['req']['user'];
      return payload.appEvents.notify.some(
        (t) =>
          (Object.values<string>(Role).includes(String(t)) &&
            t === String(user['role'])) ||
          t === String(user['sub']),
      );
    },
  })
  public appEvents(): AsyncIterator<string> {
    return this.pubSub.asyncIterator<string>('appEvents');
  }
}
