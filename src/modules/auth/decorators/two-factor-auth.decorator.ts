import { SetMetadata } from '@nestjs/common';

export const NotProtectByTwoFactorAuth = () =>
  SetMetadata('notProtectByTwoFactorAuth', true);
