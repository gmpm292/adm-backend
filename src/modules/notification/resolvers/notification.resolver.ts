import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { CreateNotificationInput } from '../dto/create-notification.input';
import { UpdateNotificationInput } from '../dto/update-notification.input';
import { NotificationService } from '../services/notification.service';
import { RoleGuard } from '../../auth/guards/role.guard';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { Roles } from '../../auth/decorators/roles.decorator';

import { NotificationAccessLevelService } from '../services/notification-access-level.service';
import { NotificationFiltersValidator } from '../filters-validator/notification-filters.validator';

import { clientNotificationsFiltersValidator } from '../filters-validator/client-notification-filters.validator';
import { Role } from '../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { Opts } from '../../../core/graphql/remote-operations/decorators/opts.decorator';

@Resolver('Notification')
export class NotificationResolver {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationAccessLevelService: NotificationAccessLevelService,
  ) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createNotification')
  create(
    @CurrentUser() user: JWTPayload,
    @Args('createNotificationInput')
    createNotificationInput: CreateNotificationInput,
  ) {
    return this.notificationService.create(user, createNotificationInput);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('notifications')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: NotificationFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.notificationService.find(
      user,
      await this.notificationAccessLevelService.forFind(user, options),
    );
  }

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('clientNotifications')
  clientNotifications(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: clientNotificationsFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.notificationService.findClientNotification(user, options);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('notification')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.notificationService.findOneByFilters(
      await this.notificationAccessLevelService.forFindOne(user, id),
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateNotification')
  update(
    @Args('updateNotificationInput')
    updateNotificationInput: UpdateNotificationInput,
  ) {
    return this.notificationService.update(
      updateNotificationInput.id,
      updateNotificationInput,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeNotifications')
  remove(@Args('ids') ids: number[]) {
    return this.notificationService.remove(ids);
  }

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('markNotificationAsRead')
  markNotificationAsRead(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: number,
  ) {
    return this.notificationService.markNotificationAsRead(user, id);
  }

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('markNotificationAsDeleted')
  markNotificationAsDeleted(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: number,
  ) {
    return this.notificationService.markNotificationAsDeleted(user, id);
  }

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('markNotificationsAsDeleted')
  markNotificationsAsDeleted(
    @CurrentUser() user: JWTPayload,
    @Args('ids') ids: Array<number>,
  ) {
    return this.notificationService.markNotificationsAsDeleted(user, ids);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('publishNotification')
  public async publishNotification(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: number,
  ) {
    await this.notificationService.publishNotification(id, user);
    return 'Successful Publication';
  }
}
