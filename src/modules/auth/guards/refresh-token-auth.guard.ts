import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { parse } from 'cookie';
import { Request } from 'express';

@Injectable()
export class RefreshTokenAuthGuard extends AuthGuard('refresh-token') {
  public getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    if (req.header('cookie')) {
      req.cookies = parse(req.header('cookie'));
    }

    return req;
  }
}
