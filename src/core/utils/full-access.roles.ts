import { Role } from '../enums/role.enum';

/** Si el usuario tiene al menos uno de los roles indicados. */
export const haveAccess = (userRoles: Role[], rolesForCheck: Role[]) => {
  let haveAcces = false;

  userRoles.forEach((r) => {
    if (rolesForCheck.includes(r)) haveAcces = true;
  });

  return haveAcces;
};
