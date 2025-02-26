/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Inject, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver, Subscription } from '@nestjs/graphql';
// import { REDIS_PUB_SUB_TOKEN } from '@app/shared/core/graphql/pubsub/pubsub.module';
import { RedisPubSub } from 'graphql-redis-subscriptions';
// import { LoggerService } from '../../../common/logger';

import { AppEventService } from '../services/app-event.service';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { AppEvent } from '../types/app-event.type';

import { Role } from '../../../core/enums/role.enum';
import { REDIS_PUB_SUB_TOKEN } from '../../../common/graphql/pubsub/pubsub.module';
import { LoggerService } from '../../../common/logger';
// import { Role } from '../../../../../../libs/shared/core';

@Resolver('appEvent')
export class AppEventResolver {
  constructor(
    private readonly eventService: AppEventService,
    private logger: LoggerService,
    @Inject(REDIS_PUB_SUB_TOKEN) private readonly pubSub: RedisPubSub,
  ) {}

  @Mutation('publish')
  public publish(@Args('appEventInput') appEventInput: AppEvent) {
    this.eventService.publish(appEventInput);
    return appEventInput;
  }

  /* @Mutation('publishNotification')
  public publishNotification(@Args('id') id: number) {
    this.eventService.publishNotification(id);
    return 'Successful Publication';
  } */

  /* @Subscription('appEvents', {
    filter: (payload, variables, context) => {
      return payload.appEvents.notify.some(
        (t) => t === variables.token,
      );
    },
  })
  public appEvents(): AsyncIterator<string> {
    return this.pubSub.asyncIterator<string>('appEvents');
  } */

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
