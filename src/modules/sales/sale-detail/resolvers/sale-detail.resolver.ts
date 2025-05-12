import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateSaleDetailInput } from '../dto/create-sale-detail.input';
import { UpdateSaleDetailInput } from '../dto/update-sale-detail.input';
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
import { SaleDetailService } from '../services/sale-detail.service';
import { SaleDetailFiltersValidator } from '../filters-validator/sale-detail-filters.validator';

@Resolver('SaleDetail')
export class SaleDetailResolver {
  constructor(private readonly saleDetailService: SaleDetailService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createSaleDetail')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createSaleDetailInput') createSaleDetailInput: CreateSaleDetailInput,
  ) {
    return this.saleDetailService.create(createSaleDetailInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('saleDetails')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: SaleDetailFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.saleDetailService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('saleDetail')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.saleDetailService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.SUPERVISOR)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('saleDetailsBySale')
  async findBySale(
    @CurrentUser() user: JWTPayload,
    @Args('saleId') saleId: number,
  ) {
    return this.saleDetailService.findBySale(saleId, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateSaleDetail')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateSaleDetailInput') updateSaleDetailInput: UpdateSaleDetailInput,
  ) {
    return this.saleDetailService.update(
      updateSaleDetailInput.id,
      updateSaleDetailInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeSaleDetails')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.saleDetailService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreSaleDetails')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.saleDetailService.restore(ids, user);
  }
}
