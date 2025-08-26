import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AccessTokenAuthGuard } from '../../../auth/guards/access-token-auth.guard';
import { CreateAttendanceInput } from '../dto/create-attendance.input';
import { UpdateAttendanceInput } from '../dto/update-attendance.input';
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

import { AttendanceFiltersValidator } from '../filters-validator/attendance-filters.validator';
import { AttendanceService } from '../services/attendance.service';

@Resolver('Attendance')
export class AttendanceResolver {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('createAttendance')
  async create(
    @CurrentUser() user: JWTPayload,
    @Args('createAttendanceInput')
    createAttendanceInput: CreateAttendanceInput,
  ) {
    return this.attendanceService.create(createAttendanceInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('attendances')
  async findAll(
    @CurrentUser() user: JWTPayload,
    @Opts({ arg: 'options', dto: AttendanceFiltersValidator })
    options?: ListOptions,
  ): Promise<ListSummary> {
    return this.attendanceService.find(options, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('attendance')
  async findOne(@CurrentUser() user: JWTPayload, @Args('id') id: number) {
    return this.attendanceService.findOne(id, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('dailyAttendance')
  async findDaily(@CurrentUser() user: JWTPayload, @Args('date') date: Date) {
    return this.attendanceService.findDailyAttendance(date, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Query('workerAttendance')
  async findWorkerAttendance(
    @CurrentUser() user: JWTPayload,
    @Args('workerId') workerId: number,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
  ) {
    return this.attendanceService.findWorkerAttendance(
      workerId,
      startDate,
      endDate,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('updateAttendance')
  async update(
    @CurrentUser() user: JWTPayload,
    @Args('updateAttendanceInput')
    updateAttendanceInput: UpdateAttendanceInput,
  ) {
    return this.attendanceService.update(
      updateAttendanceInput.id,
      updateAttendanceInput,
      user,
    );
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.AGENT)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('checkIn')
  async checkIn(
    @CurrentUser() user: JWTPayload,
    @Args('checkInInput') checkInInput: any,
  ) {
    return this.attendanceService.checkIn(checkInInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN, Role.MANAGER, Role.AGENT)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('checkOut')
  async checkOut(
    @CurrentUser() user: JWTPayload,
    @Args('checkOutInput') checkOutInput: any,
  ) {
    return this.attendanceService.checkOut(checkOutInput, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('markAsPaid')
  async markAsPaid(
    @CurrentUser() user: JWTPayload,
    @Args('ids') ids: number[],
  ) {
    return this.attendanceService.markAsPaid(ids, user);
  }

  @Roles(Role.SUPER, Role.PRINCIPAL, Role.ADMIN)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('removeAttendances')
  async remove(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.attendanceService.remove(ids, user);
  }

  @Roles(Role.SUPER)
  @UseGuards(AccessTokenAuthGuard, RoleGuard)
  @Mutation('restoreAttendances')
  async restore(@CurrentUser() user: JWTPayload, @Args('ids') ids: number[]) {
    return this.attendanceService.restore(ids, user);
  }
}
