/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
// import { haveAccess } from '@app/domain/core/utils/full-access.roles';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../dto/jwt-payload.dto';

import { Role } from '../../../core/enums/role.enum';
import { RoleGuardService } from '../../role-guard-resource/services/role-guard.service';
import { haveAccess } from '../../../core/utils/full-access.roles';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly roleGuardService: RoleGuardService,
    @InjectEntityManager()
    private readonly entitiManger: EntityManager,
  ) {}

  private matchRoles(roles: string[], userRoles: string[]): boolean {
    return roles.some((role) => {
      return userRoles.some((userRole) => role === userRole);
    });
  }

  private getCurrentUser(context: ExecutionContext): JWTPayload {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user as JWTPayload;
  }

  private getCurrentQueryOrEndPointURL(context: ExecutionContext) {
    const contextType = context.getType();
    if ((contextType as any) == 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getInfo().fieldName;
    }
    if (contextType == 'http') {
      const request = context.switchToHttp().getRequest();
      const urlWithoutParams = request.baseUrl + request.route.path;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const url = request.url;
      return urlWithoutParams;
    }
    return null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles =
      this.getRolesInRoleGuardEntity(context) ??
      this.reflector.get<string[]>('roles', context.getHandler());
    const no_roles = this.reflector.get<Role[]>(
      'no_roles',
      context.getHandler(),
    );

    const user = this.getCurrentUser(context);

    if (no_roles) {
      const matched = haveAccess(user.role, no_roles);
      if (matched) return false;
    }
    if (!roles) {
      return true;
    }

    return this.matchRoles(roles, user.role);
  }

  private getRolesInRoleGuardEntity(context: ExecutionContext) {
    const queryOrEndPointURL = this.getCurrentQueryOrEndPointURL(context);
    return queryOrEndPointURL
      ? this.roleGuardService.getRoleGuard(queryOrEndPointURL)?.roles
      : null;
  }
}
