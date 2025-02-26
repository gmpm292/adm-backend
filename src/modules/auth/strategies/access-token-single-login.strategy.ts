import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';

import { JWTPayload } from '../dto/jwt-payload.dto';
import { AuthParameterKey } from '../enums/auth-parameter-key.enum';
import { extractJWT } from '../helpers/app-jwt-extractor.helper';
import { AuthService } from '../services/auth.service';
import { UnauthorizedError } from '../../../core/errors/appErrors/UnauthorizedError.error';

@Injectable()
export class AccessTokenSingleLoginStrategy extends PassportStrategy(
  Strategy,
  'access-token-single-login',
) {
  public constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string => extractJWT(req, AuthParameterKey.AccessToken),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('ACCESS_TOKEN_SECRET') as string,
      passReqToCallback: true,
    };
    super(options);
  }

  /**
   * Returns the token payload
   *
   * @param payload Access token payload
   */
  public async validate(
    req: Request,
    payload: JWTPayload,
  ): Promise<JWTPayload> {
    const token = extractJWT(req, AuthParameterKey.AccessToken);
    const singleLogin = true;
    if (singleLogin) {
      await this.authService.validateUserToSingleLogin(payload.sub, token);
    }

    if (
      !req['notProtectByTwoFactorAuth'] &&
      payload.twoFactorAuthRequired &&
      !payload.twoFactorAuthPassed
    ) {
      throw new UnauthorizedError('Two-factor authentication required');
    }

    return payload;
  }
}
