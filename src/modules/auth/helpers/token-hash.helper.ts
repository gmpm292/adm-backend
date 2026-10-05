import { createHash } from 'crypto';

/**
 * Returns the digest stored in place of a json web token. A JWT is too long
 * for bcrypt (it only reads the first 72 bytes), so SHA-256 is used instead.
 *
 * @param token Json web token
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
