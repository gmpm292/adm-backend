/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { parse } from 'cookie';
import { AuthParameterKey } from '../../../modules/auth/enums/auth-parameter-key.enum';

/**
 * Cookies de la petición que abrió el websocket: busca en las cabeceras la
 * que contiene la de acceso y la parsea. `undefined` si no la hay.
 */
export function extractSubscriptionCookies({ extra }) {
  const rawHeaders = extra['request']['rawHeaders'];
  let cookie;
  if (Array.isArray(rawHeaders)) {
    cookie = rawHeaders.find((e) => e.includes(AuthParameterKey.AccessToken));
    cookie = typeof cookie === 'string' ? parse(cookie) : undefined;
  }
  return cookie;
}
