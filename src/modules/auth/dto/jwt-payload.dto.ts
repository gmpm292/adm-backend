import { Role } from '../../../core/enums/role.enum';

export interface JWTPayload {
  /**
   * User role
   */
  role: Role[];

  /**
   * User's ID
   */
  sub: number;

  officeId?: number;
  departmentId?: number;
  teamId?: number;

  twoFactorAuthRequired?: boolean;
  twoFactorAuthPassed?: boolean;
}
