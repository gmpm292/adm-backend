import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateDepartmentInput } from '../dto/create-department.input';
import { UpdateDepartmentInput } from '../dto/update-department.input';
import { DepartmentService } from '../services/department.service';
import { RoleGuard } from '../../../auth/guards/role.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { DepartmentFiltersValidator } from '../filters-validator/deparment-filters.validator';
import { Role } from '../../../../core/enums/role.enum';
import { Opts } from '../../../../core/graphql/remote-operations/decorators/opts.decorator';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';

@Resolver('Department')
export class DepartmentResolver {
  constructor(private readonly departmentService: DepartmentService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createDepartment')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createDepartmentInput') createDepartmentInput: CreateDepartmentInput,
  ) {
    return this.departmentService.create(createDepartmentInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('departments')
  public async find(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: DepartmentFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.departmentService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('department')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.departmentService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateDepartment')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateDepartmentInput') updateDepartmentInput: UpdateDepartmentInput,
  ) {
    return this.departmentService.update(
      updateDepartmentInput.id,
      updateDepartmentInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeDepartments')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.departmentService.remove(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreDepartments')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.departmentService.restore(ids, user);
  }
}
