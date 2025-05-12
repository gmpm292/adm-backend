import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateBusinessInput } from '../dto/create-business.input';
import { UpdateBusinessInput } from '../dto/update-business.input';
import { BusinessService } from '../services/business.service';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { Role } from '../../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';
import { BusinessFiltersValidator } from '../filters-validator/business-filters.validator';

@Resolver('Business')
export class BusinessResolver {
  constructor(private readonly businessService: BusinessService) {}

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createBusiness')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createBusinessInput') createBusinessInput: CreateBusinessInput,
  ) {
    return this.businessService.create(createBusinessInput, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('businesses')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: BusinessFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.businessService.find(options, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('business')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.businessService.findOne(id, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateBusiness')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateBusinessInput') updateBusinessInput: UpdateBusinessInput,
  ) {
    return this.businessService.update(
      updateBusinessInput.id,
      updateBusinessInput,
      user,
    );
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeBusinesses')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.businessService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreBusinesses')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.businessService.restore(ids, user);
  }
}
