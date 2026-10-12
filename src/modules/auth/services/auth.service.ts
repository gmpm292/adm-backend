/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { randomUUID } from 'crypto';
import { Response } from 'express';

import { authenticator } from 'otplib';

import { UsersService } from '../../users/services/users.service';

import { AuthParameterKey } from '../enums/auth-parameter-key.enum';
import { addBearerPrefix } from '../helpers/bearer-token.helper';
import { hashToken } from '../helpers/token-hash.helper';

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

/**
 * Segundos que se sigue aceptando un refresh token sustituido, para no cerrar
 * la sesión a peticiones que ya iban en camino (otra pestaña, un reintento).
 */
const REFRESH_TOKEN_GRACE_PERIOD = 30;
const MAX_TWO_FACTOR_ATTEMPTS = 5;
const TWO_FACTOR_LOCKOUT_SECONDS = 15 * 60;

/**
 * Emite y valida los tokens de sesión (cookies, refresh rotativo, sesión
 * única en Redis) y gestiona el segundo factor (TOTP).
 */
@Injectable()
export class AuthService {
  public constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private configService: ConfigService,
    private jwtService: JwtService,
    private loggerService: LoggerService,
    private usersService: UsersService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Pone el token de acceso en la cookie `Authorization`. Sin `expiresIn`
   * dura `ACCESS_TOKEN_EXPIRE_IN` segundos.
   */
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
   * Pone un JWT con el prefijo `Bearer` en una cookie `HttpOnly; Secure;
   * SameSite=None`. La duración sale de `expiresIn` o, si no llega, de la
   * clave de configuración `expiresInKey` (en segundos).
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

  /**
   * Borra las cookies de acceso y refresh. Los atributos deben coincidir con
   * los usados al crearlas; si no, el navegador ignora el borrado en
   * peticiones entre sitios.
   */
  public clearAuthCookies(res: Response): void {
    for (const cookieNameKey of [
      AuthParameterKey.AccessToken,
      AuthParameterKey.RefreshToken,
    ]) {
      res.clearCookie(cookieNameKey, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });
    }
  }

  /** Pone el refresh token en la cookie `Refresh`. */
  public addRefreshTokenToCookies(jwt: string, res: Response): void {
    return this.addBearerJWTToCookies(
      jwt,
      AuthParameterKey.RefreshToken,
      'REFRESH_TOKEN_EXPIRE_IN',
      res,
    );
  }

  /** Firma un token de acceso con `ACCESS_TOKEN_SECRET`. */
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
   * Firma un JWT con el id, el rol y el lugar del usuario en la empresa
   * (empresa, oficina, departamento, equipo) y el estado del 2FA. Cada token
   * lleva un `jti` aleatorio para que dos emitidos en el mismo segundo no
   * coincidan. `expiresInKey` y `secretKey` son claves de configuración.
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
        jwtid: randomUUID(),
        expiresIn,
        secret: this.configService.get(secretKey),
      },
    );
  }

  /** Firma un refresh token con `REFRESH_TOKEN_SECRET` (no lo guarda). */
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

  /**
   * Comprueba que el refresh token es el vigente del usuario (se compara su
   * SHA-256) o el recién sustituido, aún dentro de su periodo de gracia.
   * Lanza `DisabledUserError` si la cuenta está desactivada.
   */
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
    const refreshTokenHash = hashToken(refreshToken);
    if (refreshTokenHash !== user.refreshToken) {
      const replacedTokenHash = await this.cacheManager.get<string>(
        `ReplacedRefreshTokenUser${id}`,
      );
      if (refreshTokenHash !== replacedTokenHash) {
        throw new UnauthorizedError();
      }
    }

    return user;
  }

  /**
   * Emite un refresh token nuevo, guarda su hash en el usuario y lo pone en
   * la cookie. Si llega `replacedToken` (el usado para pedir este), sigue
   * valiendo `REFRESH_TOKEN_GRACE_PERIOD` segundos; si no, se anula la gracia.
   */
  public async issueRefreshToken(
    user: User,
    res: Response,
    twoFactorAuthPassed = false,
    replacedToken?: string,
  ): Promise<string> {
    if (replacedToken) {
      // cache-manager-redis-store only honours the TTL passed as { ttl } (seconds)
      await this.cacheManager.set(
        `ReplacedRefreshTokenUser${user.id}`,
        hashToken(replacedToken),
        { ttl: REFRESH_TOKEN_GRACE_PERIOD } as any,
      );
    } else {
      await this.cacheManager.del(`ReplacedRefreshTokenUser${user.id}`);
    }

    const refreshToken = this.createRefreshToken(
      user,
      undefined,
      twoFactorAuthPassed,
    );
    await this.usersService.saveRefreshToken(user.id as number, refreshToken);
    this.addRefreshTokenToCookies(refreshToken, res);

    return refreshToken;
  }

  /**
   * Sesión única: el token de acceso debe estar entre los guardados en Redis
   * para el usuario (`AccessTokenUser{id}`); si no, lanza 401.
   */
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

  /**
   * Login con correo y contraseña (bcrypt). Responde el mismo error si el
   * correo no existe o la contraseña falla; una cuenta desactivada o
   * eliminada lanza `DisabledUserError`.
   */
  public async validateUserWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<User> {
    let user: User;
    try {
      user = await this.usersService.findByEmail(email, true);
    } catch (e) {
      throw new UnauthorizedError('User or password incorrect.');
    }

    if (!user.enabled || user.deletedAt) {
      throw new DisabledUserError('User disable.');
    }

    if (!user.password) {
      throw new UnauthorizedError('User or password incorrect.');
    }
    if (!password || !user?.password) {
      throw new UnauthorizedError('User or password incorrect.');
    }
    const passwordsMatch = await compare(password, user.password);
    if (!passwordsMatch) {
      throw new UnauthorizedError('User or password incorrect.');
    }

    return user;
  }

  /**
   * Tokens de acceso del usuario guardados en Redis que siguen sin caducar:
   * los de login y, con `withInspectTokens`, también los de inspección.
   */
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

  /**
   * Registra en Redis un token de acceso válido del usuario, con el host y el
   * navegador de la petición. Un login (`UserSingleLogin`) descarta los demás
   * tokens de login: así se aplica la sesión única.
   */
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
    await this.saveAccessTokenList(user.id as number, values);
  }

  /**
   * Cierra la sesión del usuario: quita de Redis sus tokens de login y deja
   * solo los de inspección que sigan vigentes.
   */
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
    await this.saveAccessTokenList(user.id as number, values);
  }

  /**
   * Guarda en Redis la lista de tokens de acceso del usuario hasta que caduque
   * el último emitido (todos duran `ACCESS_TOKEN_EXPIRE_IN`).
   */
  private async saveAccessTokenList(
    userId: number,
    values: AccessTokenInfo[],
  ): Promise<void> {
    // cache-manager-redis-store only honours the TTL passed as { ttl } (seconds)
    await this.cacheManager.set(`AccessTokenUser${userId}`, values, {
      ttl: Number(this.configService.get('ACCESS_TOKEN_EXPIRE_IN')),
    } as any);
  }

  /**
   * Si el usuario ya tenía una sesión abierta, le envía una notificación
   * `LogOut` para que la cierre (se llama antes de un login nuevo).
   */
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

  /** Crea y publica la notificación de cierre de sesión al propio usuario. */
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

  /**
   * Genera y guarda un secreto TOTP sin activar el 2FA todavía (eso lo hace
   * `finishConfigure2FA`). Devuelve la URL `otpauth://` para el código QR;
   * el emisor está fijo como `GoldenSoft`.
   */
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

  /**
   * Comprueba un código TOTP de un usuario con el 2FA ya configurado. Tras
   * `MAX_TWO_FACTOR_ATTEMPTS` fallos bloquea los intentos durante
   * `TWO_FACTOR_LOCKOUT_SECONDS`; un acierto reinicia el contador.
   */
  async verify2FACode(id: number, token2fa: string): Promise<User> {
    const user = await this.usersService.findOne(id);

    // User is disabled
    if (!user.enabled) {
      throw new DisabledUserError();
    }
    if (!user?.twoFASecret || !user.isTwoFactorConfigured) {
      throw new UnauthorizedError(`You don't have a secret code`);
    }

    await this.checkTwoFactorCode(id, token2fa, user.twoFASecret);
    return user;
  }

  /**
   * Confirma el emparejamiento con un código válido del secreto generado y
   * deja el 2FA configurado y activo. Mismo límite de intentos que
   * `verify2FACode`.
   */
  async finishConfigure2FA(id: number, token2fa: string): Promise<User> {
    const user = await this.usersService.findOne(id);

    if (!user.twoFASecret) {
      throw new UnauthorizedError(`You don't have a secret code`);
    }
    await this.checkTwoFactorCode(id, token2fa, user.twoFASecret);
    await this.usersService.finishConfigure2FA(id);

    return user;
  }

  /**
   * Comprueba un código TOTP contra `secret`. Tras `MAX_TWO_FACTOR_ATTEMPTS`
   * fallos bloquea los intentos durante `TWO_FACTOR_LOCKOUT_SECONDS`; un
   * acierto reinicia el contador.
   */
  private async checkTwoFactorCode(
    id: number,
    token2fa: string,
    secret: string,
  ): Promise<void> {
    const attemptsKey = `TwoFactorAttempts${id}`;
    const attempts = (await this.cacheManager.get<number>(attemptsKey)) ?? 0;
    if (attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
      throw new UnauthorizedError(
        'Too many 2FA attempts. Try again in a few minutes.',
      );
    }

    const is2FAVerified = authenticator.check(token2fa ?? '', secret);
    if (!is2FAVerified) {
      // cache-manager-redis-store only honours the TTL passed as { ttl } (seconds)
      await this.cacheManager.set(attemptsKey, attempts + 1, {
        ttl: TWO_FACTOR_LOCKOUT_SECONDS,
      } as any);
      throw new UnauthorizedError('Invalid 2FA code');
    }

    await this.cacheManager.del(attemptsKey);
  }

  // Operaciones de administrador (SUPER, lo exige el resolver): delegan en
  // UsersService.
  async reset2FASettings(id: number): Promise<User> {
    return this.usersService.reset2FASettings(id);
  }

  async enable2FA(id: number): Promise<User> {
    return this.usersService.enable2FA(id);
  }

  async disable2FA(id: number): Promise<User> {
    return this.usersService.disable2FA(id);
  }

  /**
   * Desactiva el 2FA del propio usuario, que demuestra con un código que aún
   * tiene el dispositivo.
   */
  async disableOwn2FA(id: number, token2fa: string): Promise<User> {
    await this.verify2FACode(id, token2fa);
    return this.usersService.disable2FA(id);
  }
}

export class AccessTokenInfo {
  accessToken: string;
  reason: AccessTokenReason;
  metadata: any;
}
