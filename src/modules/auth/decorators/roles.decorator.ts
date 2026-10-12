import { SetMetadata } from '@nestjs/common';

/** Roles que pueden usar la operación. Solo se aplica con `RoleGuard`. */
export const Roles = (...args: string[]) => SetMetadata('roles', args);
/** Roles a los que se les deniega la operación. Solo con `RoleGuard`. */
export const NoRoles = (...args: string[]) => SetMetadata('no_roles', args);
