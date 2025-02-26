import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';

import { JWTPayload } from '../dto/jwt-payload.dto';
import { AuthParameterKey } from '../enums/auth-parameter-key.enum';
import { extractJWT } from '../helpers/app-jwt-extractor.helper';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
  Strategy,
  'access-token',
) {
  public constructor(private configService: ConfigService) {
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
  public validate(payload: JWTPayload): JWTPayload {
    return payload;
  }
}
