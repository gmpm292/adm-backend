/* eslint-disable @typescript-eslint/require-await */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-local';

import { ClassicLoginInput } from '../dto/classic-login.input';
import { getQueryArgumentsFromRequest } from '../helpers/request-body-variables.helper';
import { AuthService } from '../services/auth.service';
import { User } from '../../users/entities/user.entity';
import { UnauthorizedError } from '../../../core/errors/appErrors/UnauthorizedError.error';
import { Role } from '../../../core/enums/role.enum';

export const classicLocalStrategyName = 'classic-local';

@Injectable()
export class ClassicLocalStrategy extends PassportStrategy(
  Strategy,
  classicLocalStrategyName,
) {
  public constructor(private authService: AuthService) {
    super();
  }

  /**
   * Validate user's credentials
   *
   * @param request
   */
  public async validate(request: Request): Promise<User> {
    const { email, password } =
      getQueryArgumentsFromRequest<ClassicLoginInput>(request);

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

  /**
   * Validate user's role for access to WebApp
   *
   * @param user
   */
  private async validateRoleForWebApp(user: User): Promise<void> {
    if (!user.role?.some((r) => r !== Role.USER)) {
      throw new UnauthorizedError();
    }
    return;
  }

  /**
   * Validate user's company information.
   *
   * @param user
   */
  private async validateCompanyInformationByRole(user: User): Promise<void> {
    if (user.role?.some((r) => r === Role.ADMIN && !user.office)) {
      throw new UnauthorizedError('Admin users must have office.');
    }
    if (
      user.role?.some(
        (r) => r === Role.MANAGER && (!user.office || !user.department),
      )
    ) {
      throw new UnauthorizedError(
        'Manager users must have office and department.',
      );
    }
    if (
      user.role?.some(
        (r) =>
          r === Role.SUPERVISOR &&
          (!user.office || !user.department || !user.team),
      )
    ) {
      throw new UnauthorizedError(
        'Supervisor users must have office, department and team.',
      );
    }
    if (
      user.role?.some(
        (r) =>
          r === Role.AGENT && (!user.office || !user.department || !user.team),
      )
    ) {
      throw new UnauthorizedError(
        'Agent users must have office, department and team.',
      );
    }

    return;
  }
}
