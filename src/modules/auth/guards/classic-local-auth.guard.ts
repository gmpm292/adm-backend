import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { classicLocalStrategyName } from '../strategies/classic-local.strategy';

@Injectable()
export class ClassicLocalAuthGuard extends AuthGuard(classicLocalStrategyName) {
  public getRequest(context: ExecutionContext): Request {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
