import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Attendance } from './entities/attendance.entity';
import { WorkerModule } from '../worker/worker.module';
import { WorkScheduleModule } from '../work-schedule/work-schedule.module';
import { AttendanceResolver } from './resolvers/attendance.resolver';
import { AttendanceService } from './services/attendance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    forwardRef(() => WorkerModule),
    forwardRef(() => WorkScheduleModule),
  ],
  providers: [AttendanceResolver, AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
