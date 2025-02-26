import { SetMetadata } from '@nestjs/common';

export const Roles = (...args: string[]) => SetMetadata('roles', args);
export const NoRoles = (...args: string[]) => SetMetadata('no_roles', args);
