import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CreateScopedAccessInput } from '../dto/create-scoped-access.input';
import { UpdateScopedAccessInput } from '../dto/update-scoped-access.input';
import { ResourceScopedAccessService } from '../services/resource-scoped-access.service';

import { ScopedAccessFiltersValidator } from '../filters-validator/filters.validator';
import { AccessTokenAuthGuard } from '../../auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { Role } from '../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { Opts } from '../../../core/graphql/remote-operations/decorators/opts.decorator';

@Resolver('ScopedAccess')
export class ScopedAccessResolver {
  constructor(
    private readonly scopedAccessService: ResourceScopedAccessService,
  ) {}

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createScopedAccess')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createScopedAccessInput')
    createScopedAccessInput: CreateScopedAccessInput,
  ) {
    return this.scopedAccessService.create(createScopedAccessInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('scopedAccesses')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: ScopedAccessFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.scopedAccessService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('scopedAccess')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.scopedAccessService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateScopedAccess')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateScopedAccessInput')
    updateScopedAccessInput: UpdateScopedAccessInput,
  ) {
    return this.scopedAccessService.update(
      updateScopedAccessInput.id,
      updateScopedAccessInput,
      user,
    );
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeScopedAccesses')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.scopedAccessService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreScopedAccesses')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.scopedAccessService.restore(ids, user);
  }
}
