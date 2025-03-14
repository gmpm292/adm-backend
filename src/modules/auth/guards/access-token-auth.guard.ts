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

@Injectable()
export class AccessTokenAuthGuard extends AuthGuard(
  'access-token-single-login',
) {
  constructor(private reflector: Reflector) {
    super();
  }

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
