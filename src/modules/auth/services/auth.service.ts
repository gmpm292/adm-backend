/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { Response } from 'express';

import { authenticator } from 'otplib';

import { UsersService } from '../../users/services/users.service';

import { AuthParameterKey } from '../enums/auth-parameter-key.enum';
import { addBearerPrefix } from '../helpers/bearer-token.helper';

import { JWTPayload } from '../dto/jwt-payload.dto';
import { AccessTokenReason } from '../enums/access-token-reason';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { NotificationService } from '../../notification/services/notification.service';

import { CreateNotificationInput } from '../../notification/dto/create-notification.input';

import { User } from '../../users/entities/user.entity';
import { DisabledUserError } from '../../../core/errors/appErrors/DisabledUserError.error';
import { UnauthorizedError } from '../../../core/errors/appErrors/UnauthorizedError.error';
import { NotificationTypeEnum } from '../../notification/enums/notification-types.enumn';
import { ConfigService, EnvironmentVariables } from '../../../common/config';
import { LoggerService } from '../../../common/logger';
import { Role } from '../../../core/enums/role.enum';

@Injectable()
export class AuthService {
  private accessTokensMap: Map<
    number,
    Array<{ accessToken: string; reason: AccessTokenReason; metadata: any }>
  > = new Map();

  public constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private configService: ConfigService,
    private jwtService: JwtService,
    private loggerService: LoggerService,
    private usersService: UsersService,
    private readonly notificationService: NotificationService,
  ) {}

  public addAccessTokenToCookies(
    jwt: string,
    res: Response,
    expiresIn?: number,
  ): void {
    return this.addBearerJWTToCookies(
      jwt,
      AuthParameterKey.AccessToken,
      'ACCESS_TOKEN_EXPIRE_IN',
      res,
      expiresIn,
    );
  }

  /**
   * Add a json web token to response cookies with common configuration
   * for this purpose
   *
   * @param jwt Token
   * @param cookieNameKey Name of environment variable witch specify cookie name
   * @param expiresInKey Name of environment variable witch specify time of expiration
   * @param res Response to send to client
   */
  public addBearerJWTToCookies(
    jwt: string,
    cookieNameKey: AuthParameterKey,
    expiresInKey: keyof EnvironmentVariables,
    res: Response,
    expiresIn?: number,
  ): void {
    expiresIn = expiresIn ?? Number(this.configService.get(expiresInKey));
    res.cookie(cookieNameKey, addBearerPrefix(jwt), {
      maxAge: expiresIn * 1000,
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });
  }

  public addRefreshTokenToCookies(jwt: string, res: Response): void {
    return this.addBearerJWTToCookies(
      jwt,
      AuthParameterKey.RefreshToken,
      'REFRESH_TOKEN_EXPIRE_IN',
      res,
    );
  }

  public createAccessToken(
    user: User,
    expiresIn?: number,
    twoFactorAuthPassed?: boolean,
  ): string {
    return this.createJWT(
      user,
      'ACCESS_TOKEN_EXPIRE_IN',
      'ACCESS_TOKEN_SECRET',
      expiresIn,
      twoFactorAuthPassed,
    );
  }

  /**
   * Create a json web token with given configuration
   *
   * @param user User or Worker entity
   * @param expiresInKey Name of environment variable witch specify time of expiration
   * @param secretKey Name of environment variable witch specify secret word
   */
  public createJWT(
    user: User,
    expiresInKey: keyof EnvironmentVariables,
    secretKey: keyof EnvironmentVariables,
    expiresIn?: number,
    twoFactorAuthPassed = false,
  ): string {
    expiresIn = expiresIn ?? Number(this.configService.get(expiresInKey));
    return this.jwtService.sign(
      {
        sub: user.id,
        role: user.role,

        businessId: user.business?.id,
        officeId: user.office?.id,
        departmentId: user.department?.id,
        teamId: user.team?.id,

        twoFactorAuthRequired: user.isTwoFactorEnabled,
        twoFactorAuthPassed,
      },
      {
        expiresIn,
        secret: this.configService.get(secretKey),
      },
    );
  }

  public createRefreshToken(
    user: User,
    expiresIn?: number,
    twoFactorAuthPassed?: boolean,
  ): string {
    return this.createJWT(
      user,
      'REFRESH_TOKEN_EXPIRE_IN',
      'REFRESH_TOKEN_SECRET',
      expiresIn,
      twoFactorAuthPassed,
    );
  }

  public async validateUserToRefreshAccessToken(
    id: number,
    refreshToken: string,
  ): Promise<User> {
    const user = await this.usersService.findOne(id);

    // User is disabled
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (!refreshToken || !user?.refreshToken) {
      throw new UnauthorizedError();
    }
    //const refreshTokensMatch = await compare(refreshToken, user.refreshToken);
    const refreshTokensMatch = refreshToken == user.refreshToken;
    if (!refreshTokensMatch) {
      throw new UnauthorizedError();
    }

    return user;
  }

  public async validateUserToSingleLogin(id: number, accessToken: string) {
    const tokens = await this.cacheManager.get<Array<AccessTokenInfo>>(
      `AccessTokenUser${id}`,
    );
    const userToken = tokens?.find((e) => e.accessToken == accessToken);
    if (!userToken) {
      throw new UnauthorizedError();
    }
    return;
  }

  public async validateUserWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<User> {
    let user: User;
    try {
      user = await this.usersService.findByEmail(email, true);
    } catch (e) {
      throw new UnauthorizedError('User or pasword incorrect.');
    }

    if (!user.enabled || user.deletedAt) {
      throw new DisabledUserError('User disable.');
    }

    if (!user.password) {
      throw new UnauthorizedError('User or pasword incorrect.');
    }
    if (!password || !user?.password) {
      throw new UnauthorizedError('User or pasword incorrect.');
    }
    const passwordsMatch = await compare(password, user.password);
    if (!passwordsMatch) {
      throw new UnauthorizedError('User or pasword incorrect.');
    }

    return user;
  }

  private async getActiveAccessTokenInfo(
    userId: number,
    withInspectTokens = false,
  ): Promise<AccessTokenInfo[]> {
    let values =
      (await this.cacheManager.get<Array<AccessTokenInfo>>(
        `AccessTokenUser${userId}`,
      )) || [];
    if (values?.length > 0) {
      values = values.filter((e) => {
        let payload;
        try {
          payload = this.jwtService.verify(e.accessToken, {
            secret: this.configService.get('ACCESS_TOKEN_SECRET'),
            ignoreExpiration: false,
          });
        } catch (error) {
          payload = null;
        }
        if (
          payload &&
          (e.reason == AccessTokenReason.UserSingleLogin ||
            (e.reason == AccessTokenReason.UserInspect && withInspectTokens))
        ) {
          return true;
        }
        return false;
      });
    }
    return values;
  }

  public async saveAccessToken(
    user: User,
    accessToken: string,
    reason: AccessTokenReason,
    context: any,
  ) {
    //Delete from the list the tokens that have expired and those that are of type UserSingleLogin.
    let values =
      (await this.cacheManager.get<Array<AccessTokenInfo>>(
        `AccessTokenUser${user.id}`,
      )) || [];
    if (values?.length > 0) {
      values = values.filter((e) => {
        let payload;
        try {
          payload = this.jwtService.verify(e.accessToken, {
            secret: this.configService.get('ACCESS_TOKEN_SECRET'),
            ignoreExpiration: false,
          });
        } catch (error) {
          payload = null;
        }
        // If token is valid,
        // and reason is equal UserInspect or
        // reason is equal UserSingleLogin and the reason of de saved token is equal UserInspect, I keep this token.
        if (
          payload &&
          (reason == AccessTokenReason.UserInspect ||
            (reason == AccessTokenReason.UserSingleLogin &&
              e.reason == AccessTokenReason.UserInspect))
        ) {
          return true;
        }
        return false;
      });
    }
    const req: Request = context.req;
    values.push({
      accessToken,
      reason,
      metadata: {
        host: req.header('host'),
        userAgent: req.header('user-agent'),
      },
    });
    const expiredIn = this.configService.get('ACCESS_TOKEN_EXPIRE_IN') * 1000;
    await this.cacheManager.set(`AccessTokenUser${user.id}`, values, expiredIn);
    const a = await this.cacheManager.get(`AccessTokenUser${user.id}`);
  }

  public async removeAccessToken(user: User) {
    //Delete from the list the tokens that have expired and those that are of type UserSingleLogin.
    let values =
      (await this.cacheManager.get<Array<AccessTokenInfo>>(
        `AccessTokenUser${user.id}`,
      )) || [];
    if (values?.length > 0) {
      values = values.filter((e) => {
        let payload;
        try {
          payload = this.jwtService.verify(e.accessToken, {
            secret: this.configService.get('ACCESS_TOKEN_SECRET'),
            ignoreExpiration: false,
          });
        } catch (error) {
          payload = null;
        }
        // If token is valid,
        // and reason is equal UserInspect, I keep this token.
        if (payload && e.reason == AccessTokenReason.UserInspect) {
          return true;
        }
        return false;
      });
    }
    const expiredIn = this.configService.get('ACCESS_TOKEN_EXPIRE_IN') * 1000;
    await this.cacheManager.set(`AccessTokenUser${user.id}`, values, expiredIn);
  }

  public async checkAndNotifyCloseActiveSession(user: User) {
    const activeTokenInfo = await this.getActiveAccessTokenInfo(
      user.id as number,
    );
    if (activeTokenInfo?.length > 0) {
      await this.notifySessionClosing(
        { sub: user.id as number, role: user.role as Role[] },
        activeTokenInfo.shift() as AccessTokenInfo,
      );
    }
  }

  private async notifySessionClosing(
    currentUser: JWTPayload,
    accessTokenInfo: AccessTokenInfo,
  ) {
    const notification = await this.notificationService.create(currentUser, {
      tipo: NotificationTypeEnum.Info,
      titulo: 'Log out',
      message: `The active session has been closed in: ${accessTokenInfo.metadata.userAgent}`,
      userIds: [String(currentUser.sub)],
      metadata: {
        type: 'LogOut',
        id: currentUser.sub,
      },
    } as CreateNotificationInput);
    await this.notificationService.publishNotification(
      notification.id as number,
    );
  }

  async generate2FASecret(currentUser: JWTPayload) {
    const secret = authenticator.generateSecret();
    // Store this secret in the user's profile or database
    const user = await this.usersService.save2FASecret(currentUser.sub, secret);
    // Then return the secret or QR code for the user to scan
    const otpAuthUrl = authenticator.keyuri(
      user?.email ?? '',
      'GoldenSoft',
      secret,
    );
    return otpAuthUrl;
  }

  async verify2FACode(id: number, token2fa: string): Promise<User> {
    const user = await this.usersService.findOne(id);

    // User is disabled
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (!user?.twoFASecret) {
      throw new UnauthorizedError(`You don't have a secret code`);
    }

    const is2FAVerified = authenticator.check(token2fa, user.twoFASecret);
    if (!is2FAVerified) {
      throw new UnauthorizedError('Invalid 2FA code');
    }
    return user;
  }

  async finishConfigure2FA(id: number, token2fa: string): Promise<User> {
    const user = await this.usersService.findOne(id);

    const is2FAVerified = authenticator.check(
      token2fa,
      user.twoFASecret as string,
    );
    if (!is2FAVerified) {
      throw new UnauthorizedError('Invalid 2FA code');
    }
    await this.usersService.finishConfigure2FA(id);

    return user;
  }

  async reset2FASettings(id: number): Promise<User> {
    return this.usersService.reset2FASettings(id);
  }

  async enable2FA(id: number): Promise<User> {
    return this.usersService.enable2FA(id);
  }

  async disable2FA(id: number): Promise<User> {
    return this.usersService.disable2FA(id);
  }
}

export class AccessTokenInfo {
  accessToken: string;
  reason: AccessTokenReason;
  metadata: any;
}
