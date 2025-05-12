import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateOfficeInput } from '../dto/create-office.input';
import { UpdateOfficeInput } from '../dto/update-office.input';
import { OfficeService } from '../services/office.service';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { OfficeFiltersValidator } from '../filters-validator/office-filters.validator';
import { Role } from '../../../../core/enums/role.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';

@Resolver('Office')
export class OfficeResolver {
  constructor(private readonly officeService: OfficeService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createOffice')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createOfficeInput') createOfficeInput: CreateOfficeInput,
  ) {
    return this.officeService.create(createOfficeInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('offices')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: OfficeFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.officeService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('office')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.officeService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateOffice')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateOfficeInput') updateOfficeInput: UpdateOfficeInput,
  ) {
    return this.officeService.update(
      updateOfficeInput.id,
      updateOfficeInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeOffices')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.officeService.remove(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreOffices')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.officeService.restore(ids, user);
  }
}
