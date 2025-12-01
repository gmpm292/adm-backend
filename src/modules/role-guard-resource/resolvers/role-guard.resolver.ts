import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CreateRoleGuardInput } from '../dto/create-role-guard.input';
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

  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('createRoleGuard')
  create(
    @Args('createRoleGuardInput') createRoleGuardInput: CreateRoleGuardInput,
  ) {
    return this.roleGuardService.create(createRoleGuardInput);
  }

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

  // @UseGuards(AccessTokenAuthGuard, RoleGuard)
  // @Mutation('removeRoleGuards')
  remove(@Args('ids') ids: number[]) {
    return this.roleGuardService.remove(ids);
  }

  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('checkPermissions')
  checkPermissions(
    @Args('operationName') operationName: string,
    @CurrentUser() user: JWTPayload,
  ): { allowed: boolean; requiredRoles: Array<Role> } {
    const roleGuard = this.roleGuardService.getRoleGuard(operationName);

    if (!roleGuard) {
      // Si no existe roleGuard para esta operación, permitir acceso
      return { allowed: false, requiredRoles: [] };
    }

    // Verificar si el usuario tiene alguno de los roles permitidos
    const userRoles = user.role || [];
    const hasAccess =
      roleGuard.roles?.some((role) => userRoles.includes(role)) || false;

    return {
      allowed: hasAccess,
      requiredRoles: roleGuard.roles || [],
    };
  }
}
