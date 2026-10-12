import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { mobileLocalStrategyName } from '../strategies/mobile-local.strategy';

/** Login de la app móvil (estrategia `mobile-local`, solo rol USER). */
@Injectable()
export class MobileLocalAuthGuard extends AuthGuard(mobileLocalStrategyName) {
  public getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
