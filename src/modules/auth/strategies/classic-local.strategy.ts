/* eslint-disable @typescript-eslint/require-await */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../services/auth.service';
import { User } from '../../users/entities/user.entity';
import { UnauthorizedError } from '../../../core/errors/appErrors/UnauthorizedError.error';
import { Role } from '../../../core/enums/role.enum';

export const classicLocalStrategyName = 'classic-local';

/**
 * Login de la aplicación web: correo y contraseña, con un rol distinto de
 * USER y el lugar en la empresa que exige cada rol.
 */
@Injectable()
export class ClassicLocalStrategy extends PassportStrategy(
  Strategy,
  classicLocalStrategyName,
) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  public async validate(req, email: string, password: string): Promise<User> {
    const user = await this.authService.validateUserWithEmailAndPassword(
      email,
      password,
    );

    //Validate user's role for web app. Cannot access role user.
    await this.validateRoleForWebApp(user);

    //Validate company information.
    await this.validateCompanyInformationByRole(user);

    return user;
  }

  /** Rechaza a quien solo tiene el rol USER (es el de la app móvil). */
  private async validateRoleForWebApp(user: User): Promise<void> {
    if (!user.role?.some((r) => r !== Role.USER)) {
      throw new UnauthorizedError();
    }
    return;
  }

  /**
   * Cada rol exige su lugar en la empresa: PRINCIPAL empresa; ADMIN además
   * oficina; MANAGER además departamento; SUPERVISOR y AGENT además equipo.
   */
  private async validateCompanyInformationByRole(user: User): Promise<void> {
    if (user.role?.some((r) => r === Role.PRINCIPAL && !user.business)) {
      throw new UnauthorizedError('Principal users must have business.');
    }
    if (
      user.role?.some(
        (r) => r === Role.ADMIN && (!user.business || !user.office),
      )
    ) {
      throw new UnauthorizedError('Admin users must have business and office.');
    }
    if (
      user.role?.some(
        (r) =>
          r === Role.MANAGER &&
          (!user.business || !user.office || !user.department),
      )
    ) {
      throw new UnauthorizedError(
        'Manager users must have business, office and department.',
      );
    }
    if (
      user.role?.some(
        (r) =>
          r === Role.SUPERVISOR &&
          (!user.business || !user.office || !user.department || !user.team),
      )
    ) {
      throw new UnauthorizedError(
        'Supervisor users must have business, office, department and team.',
      );
    }
    if (
      user.role?.some(
        (r) =>
          r === Role.AGENT &&
          (!user.business || !user.office || !user.department || !user.team),
      )
    ) {
      throw new UnauthorizedError(
        'Agent users must have business, office, department and team.',
      );
    }

    return;
  }
}
