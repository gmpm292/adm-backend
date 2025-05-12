/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { classicLocalStrategyName } from '../strategies/classic-local.strategy';

@Injectable()
export class ClassicLocalAuthGuard extends AuthGuard(classicLocalStrategyName) {
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error) {
      console.log('Guard - Error:', error);
      throw error;
    }
  }
}
