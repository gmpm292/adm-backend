import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { UpdateRoleGuardInput } from '../dto/update-role-guard.input';
import { RoleGuardService } from '../services/role-guard.service';

import { FiltersValidator } from '../filters-validator/filters.validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../../core/enums/role.enum';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { Opts } from '../../../core/graphql/remote-operations/decorators/opts.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';

@Resolver('RoleGuard')
export class RoleGuardResolver {
  constructor(private readonly roleGuardService: RoleGuardService) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('roleGuards')
  findAll(
    @Opts({ arg: 'options', dto: FiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.roleGuardService.findInDB(options);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('roleGuard')
  findOne(@Args('id') id: number) {
    return this.roleGuardService.findOneInDB(id);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateRoleGuard')
  update(
    @Args('updateRoleGuardInput') updateRoleGuardInput: UpdateRoleGuardInput,
  ) {
    return this.roleGuardService.update(
      updateRoleGuardInput.id,
      updateRoleGuardInput,
    );
  }

  /** Si el usuario pasaría el control de roles de la operación */
  @UseGuards(AccessTokenAuthGuard)
  @Query('checkPermissions')
  checkPermissions(
    @Args('operationName') operationName: string,
    @CurrentUser() user: JWTPayload,
  ): { allowed: boolean; requiredRoles: Array<Role> } {
    const { usesRoleGuard, roles } =
      this.roleGuardService.getEffectiveRoles(operationName);
    if (!usesRoleGuard || !roles) {
      return { allowed: true, requiredRoles: [] };
    }
    const userRoles = user.role || [];
    return {
      allowed: roles.some((role) => userRoles.includes(role)),
      requiredRoles: roles,
    };
  }
}
