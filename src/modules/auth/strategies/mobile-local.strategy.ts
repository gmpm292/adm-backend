import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-local';

import { ClassicLoginInput } from '../dto/classic-login.input';
import { getQueryArgumentsFromRequest } from '../helpers/request-body-variables.helper';
import { AuthService } from '../services/auth.service';
import { Role } from '../../../core/enums/role.enum';
import { UnauthorizedError } from '../../../core/errors/appErrors/UnauthorizedError.error';
import { User } from '../../users/entities/user.entity';

export const mobileLocalStrategyName = 'mobile-local';

/** Login de la app móvil: correo y contraseña de un usuario con rol USER. */
@Injectable()
export class MobileLocalStrategy extends PassportStrategy(
  Strategy,
  mobileLocalStrategyName,
) {
  public constructor(private authService: AuthService) {
    super();
  }

  /**
   * Toma las credenciales de la primera variable de la petición GraphQL y
   * exige el rol USER.
   */
  public async validate(request: Request): Promise<User> {
    const { email, password } =
      getQueryArgumentsFromRequest<ClassicLoginInput>(request);

    const user = await this.authService.validateUserWithEmailAndPassword(
      email,
      password,
    );

    //Validate user's role for app mobile.
    if (!user.role?.some((r) => r === Role.USER)) {
      throw new UnauthorizedError();
    }

    return user;
  }
}
