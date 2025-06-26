import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CreateConfigInput } from '../dto/create-config.input';
import { UpdateConfigInput } from '../dto/update-config.input';

import { ConfigResourceService } from '../services/config-resource.service';

import { FiltersValidator } from '../filters-validator/filters.validator';
import { Role } from '../../../../core/enums/role.enum';
import { Roles } from '../../../../modules/auth/decorators/roles.decorator';
import { AccessTokenAuthGuard } from '../../../../modules/auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../../../modules/auth/guards/role.guard';
import { CurrentUser } from '../../../../modules/auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../../modules/auth/dto/jwt-payload.dto';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';

@Resolver('Config')
export class ConfigResourceResolver {
  constructor(private readonly configService: ConfigResourceService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createConfig')
  create(@Args('createConfigInput') createConfigInput: CreateConfigInput) {
    return this.configService.create(createConfigInput);
  }

  @Roles(
    Role.SUPER,
    Role.PRINCIPAL,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.AGENT,
  )
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('configs')
  findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: FiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.configService.find(options);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('config')
  findOne(@Args('id') id: number, @CurrentUser() user: JWTPayload) {
    return this.configService.findOne(id);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateConfig')
  update(@Args('updateConfigInput') updateConfigInput: UpdateConfigInput) {
    return this.configService.update(updateConfigInput.id, updateConfigInput);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeConfigs')
  remove(@Args('ids') ids: number[]) {
    return this.configService.remove(ids);
  }
}
