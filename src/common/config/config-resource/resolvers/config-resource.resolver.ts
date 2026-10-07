import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CreateConfigInput } from '../dto/create-config.input';
import { UpdateConfigInput } from '../dto/update-config.input';

import { ConfigResourceService } from '../services/config-resource.service';
import { Config } from '../entities/config.entity';

import { FiltersValidator } from '../filters-validator/filters.validator';
import { Role } from '../../../../core/enums/role.enum';
import { Roles } from '../../../../modules/auth/decorators/roles.decorator';
import { AccessTokenAuthGuard } from '../../../../modules/auth/guards/access-token-auth.guard';
import { RoleGuard } from '../../../../modules/auth/guards/role.guard';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';

/** Configuración del sistema: solo SUPER, y los secretos salen enmascarados */
@Resolver('Config')
export class ConfigResourceResolver {
  constructor(private readonly configService: ConfigResourceService) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createConfig')
  async create(
    @Args('createConfigInput') createConfigInput: CreateConfigInput,
  ) {
    return this.configService.maskSecrets(
      await this.configService.create(createConfigInput),
    );
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('configs')
  async findAll(
    @Opts({ arg: 'options', dto: FiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    const result = await this.configService.find(options);
    return {
      ...result,
      data: (result.data as Config[]).map((c) =>
        this.configService.maskSecrets(c),
      ),
    };
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('config')
  async findOne(@Args('id') id: number) {
    return this.configService.maskSecrets(await this.configService.findOne(id));
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateConfig')
  async update(
    @Args('updateConfigInput') updateConfigInput: UpdateConfigInput,
  ) {
    return this.configService.maskSecrets(
      await this.configService.update(updateConfigInput.id, updateConfigInput),
    );
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeConfigs')
  async remove(@Args('ids') ids: number[]) {
    return (await this.configService.remove(ids)).map((c) =>
      this.configService.maskSecrets(c),
    );
  }
}
