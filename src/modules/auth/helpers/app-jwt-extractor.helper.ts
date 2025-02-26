import { Request } from 'express';

import { AuthParameterKey } from '../enums/auth-parameter-key.enum';

import { removeBearerPrefix } from './bearer-token.helper';

export function extractJWT(
  req: Request,
  tokenParamKey: AuthParameterKey,
): string {
  // extract the token from headers (first choice) or cookies (second choice)
  const bearerToken = req.header(tokenParamKey) ?? req.cookies?.[tokenParamKey];

  return removeBearerPrefix(bearerToken);
}
