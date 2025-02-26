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

@Injectable()
export class MobileLocalStrategy extends PassportStrategy(
  Strategy,
  mobileLocalStrategyName,
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

    //Validate user's role for app mobile.
    if (!user.role?.some((r) => r === Role.USER)) {
      throw new UnauthorizedError();
    }

    return user;
  }
}
