import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

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
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  /**
   * Recibe las credenciales que `MobileLocalAuthGuard` copia al cuerpo de la
   * petición y exige el rol USER.
   */
  public async validate(req, email: string, password: string): Promise<User> {
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
