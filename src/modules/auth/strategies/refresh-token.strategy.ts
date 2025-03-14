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
   * Returns the token payload
   *
   * @param req
   * @param payload Access token payload
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
