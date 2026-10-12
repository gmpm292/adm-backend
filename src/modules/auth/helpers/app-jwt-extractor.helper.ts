import { Request } from 'express';

import { AuthParameterKey } from '../enums/auth-parameter-key.enum';

import { removeBearerPrefix } from './bearer-token.helper';

/**
 * Lee el token de la cabecera o, si no viene, de la cookie con el mismo
 * nombre (`Authorization` o `Refresh`), y le quita el prefijo `Bearer`.
 */
export function extractJWT(
  req: Request,
  tokenParamKey: AuthParameterKey,
): string {
  // extract the token from headers (first choice) or cookies (second choice)
  const bearerToken = req.header(tokenParamKey) ?? req.cookies?.[tokenParamKey];

  return removeBearerPrefix(bearerToken);
}
