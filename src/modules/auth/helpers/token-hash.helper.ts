import { createHash } from 'crypto';

/**
 * Hash que se guarda en lugar de un JWT. Un JWT es demasiado largo para
 * bcrypt (solo lee los primeros 72 bytes), por eso se usa SHA-256.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
