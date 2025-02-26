import { Role } from '../enums/role.enum';

const FULL_BUSSINES_ACCESS_ROLES = [Role.SUPER, Role.PRINCIPAL];
export const haveFullAccess = (roles: Role[]) => {
  let haveFull = false;
  FULL_BUSSINES_ACCESS_ROLES.forEach((r) => {
    if (roles.includes(r)) haveFull = true;
  });
  return haveFull;
};

export const haveAccess = (userRoles: Role[], rolesForCheck: Role[]) => {
  let haveAcces = false;

  userRoles.forEach((r) => {
    if (rolesForCheck.includes(r)) haveAcces = true;
  });

  return haveAcces;
};

// export const GetTeamAccesTree = () => {
//   const TeamPolicesAccess: Map<TeamTypeEnum, PolicyStatus[]> = new Map();
//   const endorsment: PolicyStatus[] = [
//     PolicyStatus.ENDORSMENT,
//     PolicyStatus.ENDORSMENT_RENOVATION,
//   ];
//   TeamPolicesAccess.set(TeamTypeEnum.OPERATIONS, [
//     PolicyStatus.OK,
//     PolicyStatus.RW,
//     PolicyStatus.RW_CANCELLED,
//     PolicyStatus.RW_EXPIRED,
//     PolicyStatus.NEW_BUSSINESS,
//     PolicyStatus.RW_RENOVATION,
//     ...endorsment,
//   ]);

//   TeamPolicesAccess.set(TeamTypeEnum.RENOVATIONS, [
//     PolicyStatus.RENEWAL,
//     PolicyStatus.CANCELLED,
//     PolicyStatus.EXPIRED,
//     ...endorsment,
//   ]);

//   TeamPolicesAccess.set(TeamTypeEnum.NEW_BUSINESS, endorsment);
//   return TeamPolicesAccess;
// };
