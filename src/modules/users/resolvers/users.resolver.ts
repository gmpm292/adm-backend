/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-expressions */

import { Inject, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { ChangePasswordInput } from '../dto/change-password.input';
import { CreateUserInput } from '../dto/create-user.input';
import { RequestPasswordChangeInput } from '../dto/request-password-change.input';
import { UpdateUserInput } from '../dto/update-user.input';
import { UsersService } from '../services/users.service';
import { RoleGuard } from '../../auth/guards/role.guard';
import { ConfirmationTokenService } from '../confirmationToken/services/confirmation-token.service';
import { NoRoles, Roles } from '../../auth/decorators/roles.decorator';
import { ChangePasswordByEmailInput } from '../dto/change-password-by-email.input';
import { UserAccessLevelService } from '../services/user-access-level.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { CreateFirstUserInput } from '../dto/create-first-user.input';
import { UpdateUserProfileInput } from '../dto/update-user-profile.input';
import { CheckConfirmationTokenInput } from '../dto/check-confirmation-Token.input';
import { UpdateUserRoleInput } from '../dto/update-user-role.input';
import { UserFiltersValidator } from '../filters-validator/user-filters.validator';

import { Opts } from '../../../core/graphql/remote-operations/decorators/opts.decorator';
import { Role } from '../../../core/enums/role.enum';
import { User } from '../entities/user.entity';

import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';

import { LoggerService } from '../../../common/logger';
import { REDIS_PUB_SUB_TOKEN } from '../../../common/graphql/pubsub/pubsub.module';
import { IAppMailer } from '../../../core/mailer/app-mailer.interface';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Resolver('User')
export class UsersResolver {
  public constructor(
    @Inject(REDIS_PUB_SUB_TOKEN) private readonly pubSub: RedisPubSub,
    private mailerService: IAppMailer,
    private logger: LoggerService,
    private readonly usersService: UsersService,
    private confirmationTokenService: ConfirmationTokenService,
    private readonly uals: UserAccessLevelService, // @InjectQueue('email'+'_'+ process.env.TYPEORM_DATABASE) private emailQueue: Queue,
  ) {}

  @NoRoles(Role.AGENT, Role.USER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('users')
  public async find(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: UserFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.usersService.find(await this.uals.forFind(user, options));
  }

  @NoRoles(Role.USER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('user')
  public async findOne(
    @CurrentUser() user: JWTPayload,
    @Args('id') id: number,
  ): Promise<User> {
    const result = await this.uals.forFindOne(user, id);
    return this.usersService.findOne(id, result.filters);
  }

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('profile')
  public async profile(@CurrentUser() user: JWTPayload): Promise<User> {
    return this.usersService.findOne(user.sub);
  }

  @Mutation('changePassword')
  public async changePassword(
    @Args('changePasswordInput') changePasswordInput: ChangePasswordInput,
  ): Promise<User> {
    const updatedUser =
      await this.usersService.changePassword(changePasswordInput);

    await this.pubSub.publish('userChanged', { userChanged: true });

    await this.mailerService
      .notifySuccessSettingPassword(updatedUser)
      .catch((reason) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.logger.error('Notification of user creation failed', reason),
      );

    return updatedUser;
  }

  //@Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('changePasswordByEmail')
  public async changePasswordByEmail(
    @CurrentUser() user: JWTPayload,
    @Args('changePasswordByEmailInput')
    changePasswordByEmailInput: ChangePasswordByEmailInput,
  ): Promise<User> {
    const updatedUser = await this.usersService.changePasswordByEmail(
      await this.uals.forChangePasswordByEmail(
        user,
        changePasswordByEmailInput,
      ),
      user,
    );

    await this.pubSub.publish('userChanged', { userChanged: true });

    this.mailerService
      .notifySuccessSettingPassword(updatedUser)
      .catch((reason) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.logger.error('Notification of user creation failed', reason),
      );

    return updatedUser;
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @Mutation('createFirstUser')
  public async createFirstUser(
    @Args('createFirstUserInput') createFirstUserInput: CreateFirstUserInput,
  ): Promise<User> {
    const createdUser =
      await this.usersService.createFirstUser(createFirstUserInput);

    await this.pubSub.publish('userChanged', { userChanged: true });

    await this.mailerService.notifyUserCreation(createdUser).catch((reason) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.logger.error('Notification of user creation failed', reason),
    );

    return createdUser;
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Mutation('createUser')
  public async create(
    @CurrentUser() user: JWTPayload,
    @Args('createUserInput') createUserInput: CreateUserInput,
  ): Promise<User> {
    const createdUser = await this.usersService.create(
      await this.uals.forCreate(user, createUserInput),
      user,
    );

    await this.pubSub.publish('userChanged', { userChanged: true });

    this.mailerService.notifyUserCreation(createdUser).catch((reason) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.logger.error('Notification of user creation failed', reason),
    );

    return createdUser;
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeUsers')
  public async remove(
    @CurrentUser() user: JWTPayload,
    @Args('ids') ids: number[],
  ): Promise<User[]> {
    const result = await this.uals.forRemove(user, ids);

    const removedUsers = await this.usersService.remove(
      result.ids,
      result.filters,
      user,
    );

    await this.pubSub.publish('userChanged', { userChanged: true });

    return removedUsers;
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreUsers')
  public async restoreUsers(
    @CurrentUser() user: JWTPayload,
    @Args('ids') ids: number[],
  ): Promise<number> {
    return this.usersService.restore(ids, user);
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @Mutation('requestPasswordChange')
  public async requestPasswordChange(
    @Args('input') { email }: RequestPasswordChangeInput,
  ): Promise<string> {
    const user = await this.usersService.findByEmail(email);
    if (!user.enabled) {
      return 'Successful Request';
    }

    const confirmationToken =
      await this.confirmationTokenService.createConfirmationToken(
        user.id as number,
      );
    user.confirmationToken = confirmationToken.tokenValue;

    await this.pubSub.publish('userChanged', { userChanged: true });

    await this.mailerService.notifyPasswordRecovery(user).catch((reason) =>
      this.logger.error(
        'Notification of request to change password failed',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        reason,
      ),
    );

    return 'Successful Request';
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('requestPasswordChangeForAnotherUser')
  public async requestPasswordChangeForAnotherUser(
    @Args('input') { email }: RequestPasswordChangeInput,
    @CurrentUser() currentUser: JWTPayload,
  ): Promise<string> {
    const user = await this.usersService.findByEmail(email);
    await this.uals.forRequestPasswordChangeForAnotherUser(currentUser, user);

    const confirmationToken =
      await this.confirmationTokenService.createConfirmationToken(
        user.id as number,
      );
    user.confirmationToken = confirmationToken.tokenValue;

    await this.pubSub.publish('userChanged', { userChanged: true });

    await this.mailerService.notifyPasswordRecovery(user).catch((reason) =>
      this.logger.error(
        'Notification of request to change password failed',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        reason,
      ),
    );

    return 'Successful Request';
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @Mutation('checkConfirmationToken')
  public async checkConfirmationToken(
    @Args('checkConfirmationTokenInput')
    checkConfirmationTokenInput: CheckConfirmationTokenInput,
  ): Promise<boolean> {
    return await this.usersService.checkConfirmationToken(
      checkConfirmationTokenInput,
    );
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  //@UsePipes(new ValidationPipe({ transform: true }))
  @Mutation('updateUser')
  public async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
  ): Promise<User> {
    const result = await this.uals.forFindOne(user, updateUserInput.id);
    const updatedUser = await this.usersService.update(
      result.id,
      updateUserInput,
      user,
      result.filters,
    );

    await this.pubSub.publish('userChanged', { userChanged: true });

    return updatedUser as User;
  }

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  //@UsePipes(new ValidationPipe({ transform: true }))
  @Mutation('updateUserProfile')
  public async updateUserProfile(
    @CurrentUser() user: JWTPayload,
    @Args('updateUserProfileInput')
    updateUserProfileInput: UpdateUserProfileInput,
  ): Promise<User> {
    const updatedUser = await this.usersService.updateUserProfile(
      user,
      updateUserProfileInput,
    );

    await this.pubSub.publish('userChanged', { userChanged: true });

    return updatedUser as User;
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateUserRole')
  public async updateUserRole(
    @CurrentUser() user: JWTPayload,
    @Args('updateUserRoleInput') updateUserRoleInput: UpdateUserRoleInput,
  ): Promise<User> {
    const result = await this.uals.forUpdateUserRole(
      user,
      updateUserRoleInput.id,
      updateUserRoleInput,
    );
    const updatedUser = await this.usersService.updateUserRole(
      result.id,
      updateUserRoleInput,
      user,
      result.filters,
    );

    await this.pubSub.publish('userChanged', { userChanged: true });

    return updatedUser as User;
  }

  @Subscription('userChanged')
  public userChanged(): AsyncIterator<boolean> {
    return this.pubSub.asyncIterableIterator<boolean>('userChanged');
  }
}
UpdateUserProfileInput;
