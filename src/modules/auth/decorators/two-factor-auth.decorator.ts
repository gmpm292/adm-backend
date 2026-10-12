import { SetMetadata } from '@nestjs/common';

/**
 * Permite usar la operación con el segundo factor pendiente (login, logout,
 * configurar o verificar el 2FA). Lo lee `AccessTokenAuthGuard`.
 */
export const NotProtectByTwoFactorAuth = () =>
  SetMetadata('notProtectByTwoFactorAuth', true);
