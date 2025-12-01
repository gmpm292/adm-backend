/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);

export const CurrentUserWithContext = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    // Obtener el usuario
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user;

    // Obtener la URL/query
    const contextType = context.getType();
    let currentQueryOrEndpoint: string | null = null;

    if ((contextType as any) == 'graphql') {
      currentQueryOrEndpoint = ctx.getInfo().fieldName;
    } else if (contextType == 'http') {
      const request = context.switchToHttp().getRequest();
      currentQueryOrEndpoint = request.baseUrl + request.route.path;
    }

    return {
      ...user,
      currentQueryOrEndpoint,
    };
  },
);
