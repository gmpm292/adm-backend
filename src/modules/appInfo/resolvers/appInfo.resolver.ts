/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Inject, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { LoggerService } from '../../../common/logger';
import { AppInfoInput } from '../dto/app-info.input';
import { AppInfoService } from '../services/appInfo.service';
import { REDIS_PUB_SUB_TOKEN } from '../../../common/graphql/pubsub/pubsub.module';
import { AppInfo } from '../models/app-info.model';
import { Notification } from '../models/notification.model';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { CurrentUserWithContext } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';

@Resolver(() => AppInfo)
export class AppInfoResolver {
  constructor(
    private readonly appInfoService: AppInfoService,
    private logger: LoggerService,
    @Inject(REDIS_PUB_SUB_TOKEN) private readonly pubSub: RedisPubSub,
  ) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('appInfo')
  appInfo(@CurrentUserWithContext() user: JWTPayload) {
    const a = user;
    return this.appInfoService.appInfo();
  }

  @Mutation(() => AppInfo)
  updateAppInfo(@Args('appInfoInput') appInfoInput: AppInfoInput) {
    this.pubSub
      .publish('appInfoChanged', { appInfoChanged: true })
      .catch((error) =>
        this.logger.error(
          'Some error happen when publish appInfoChanged event.',
          error,
        ),
      );

    this.appInfoService.notify({
      notify: ['carlos', 'pedro'],
      message: 'mensaje de notificacion',
    });

    return this.appInfoService.updateAppInfo(appInfoInput);
  }

  @Subscription(() => Boolean, {
    name: 'appInfoChanged',
  })
  appInfoChanged() {
    return this.pubSub.asyncIterator<boolean>('appInfoChanged');
  }

  @Subscription(() => Notification, {
    name: 'graphqlNotifications',
    filter(payload, variables) {
      return payload.graphqlNotifications.notify.some(
        (t) => t === variables.token,
      );
    },
  })
  graphqlNotifications() {
    return this.pubSub.asyncIterator<Notification>('graphqlNotifications');
  }
}
