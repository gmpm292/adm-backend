/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { parse } from 'cookie';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';

/**
 * Exige un token de acceso válido y de la sesión activa (estrategia
 * `access-token-single-login`). Deja el payload en `req.user`.
 */
@Injectable()
export class AccessTokenAuthGuard extends AuthGuard(
  'access-token-single-login',
) {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Prepara la petición GraphQL para Passport: parsea las cookies y anota si
   * la operación lleva `@NotProtectByTwoFactorAuth()` (la estrategia lo lee
   * para dejar pasar sin el segundo factor).
   */
  public getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    if (req.header('cookie')) {
      req.cookies = parse(req.header('cookie'));
    }

    const notProtectByTwoFactorAuth = this.reflector.get<boolean>(
      'notProtectByTwoFactorAuth',
      context.getHandler(),
    );
    req.notProtectByTwoFactorAuth = notProtectByTwoFactorAuth;

    return req;
  }
}
