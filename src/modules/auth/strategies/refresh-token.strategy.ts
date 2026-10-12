import { Injectable } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';

import { JWTPayload } from '../dto/jwt-payload.dto';
import { AuthParameterKey } from '../enums/auth-parameter-key.enum';
import { extractJWT } from '../helpers/app-jwt-extractor.helper';
import { AuthService } from '../services/auth.service';
import { User } from '../../users/entities/user.entity';
import { ConfigService } from '../../../common/config';

/** Valida el refresh token de la cabecera o la cookie `Refresh`. */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh-token',
) {
  public constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string =>
          extractJWT(req, AuthParameterKey.RefreshToken),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('REFRESH_TOKEN_SECRET') as string,
      passReqToCallback: true,
    };
    super(options);
  }

  /**
   * Devuelve el usuario (no el payload) si el token es el vigente o el recién
   * sustituido. Deja el payload en `req.refreshPayload` para que `refresh`
   * conserve `twoFactorAuthPassed`.
   */
  public validate(req: Request, payload: JWTPayload): Promise<User> {
    const token = extractJWT(req, AuthParameterKey.RefreshToken);
    req['refreshPayload'] = payload;

    return this.authService.validateUserToRefreshAccessToken(
      payload.sub,
      token,
    );
  }
}
