/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { mobileLocalStrategyName } from '../strategies/mobile-local.strategy';

/** Login de la app móvil (estrategia `mobile-local`, solo rol USER). */
@Injectable()
export class MobileLocalAuthGuard extends AuthGuard(mobileLocalStrategyName) {
  /**
   * Copia `email` y `password` del argumento `input` de GraphQL al cuerpo de
   * la petición, que es donde los busca passport-local.
   */
  public getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    const gqlReq = ctx.getContext().req;
    const { input } = ctx.getArgs();

    gqlReq.body = {
      ...gqlReq.body,
      email: input?.email,
      password: input?.password,
      input: input,
    };

    return gqlReq;
  }
}
