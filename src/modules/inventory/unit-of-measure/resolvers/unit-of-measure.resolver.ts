import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateUnitOfMeasureInput } from '../dto/create-unit-of-measure.input';
import { UpdateUnitOfMeasureInput } from '../dto/update-unit-of-measure.input';
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
import { UnitOfMeasureService } from '../services/unit-of-measure.service';
import { UnitOfMeasureFiltersValidator } from '../filters-validator/unit-of-measure.filters.validator';

@Resolver('UnitOfMeasure')
export class UnitOfMeasureResolver {
  constructor(private readonly unitOfMeasureService: UnitOfMeasureService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createUnitOfMeasure')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createUnitOfMeasureInput')
    createUnitOfMeasureInput: CreateUnitOfMeasureInput,
  ) {
    return this.unitOfMeasureService.create(createUnitOfMeasureInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('unitOfMeasures')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: UnitOfMeasureFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.unitOfMeasureService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('unitOfMeasure')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.unitOfMeasureService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateUnitOfMeasure')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateUnitOfMeasureInput')
    updateUnitOfMeasureInput: UpdateUnitOfMeasureInput,
  ) {
    return this.unitOfMeasureService.update(
      updateUnitOfMeasureInput.id,
      updateUnitOfMeasureInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeUnitsOfMeasure')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.unitOfMeasureService.remove(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreUnitsOfMeasure')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.unitOfMeasureService.restore(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('toggleUnitOfMeasureActive')
  async toggleActive(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.unitOfMeasureService.toggleActive(id, user);
  }
}
