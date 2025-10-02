import { forwardRef, Module } from '@nestjs/common';
import { ScheduledTask } from './entities/scheduled-task.entity';
import { TaskSchedulerService } from './services/task-scheduler.service';
import { TaskRegistryService } from './services/task-registry.service';
import { TaskHandlerService } from './services/task-handler.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceModule } from '../payroll/attendance/attendance.module';
import { WorkerModule } from '../payroll/worker/worker.module';
import { AttendanceGeneratorService } from './handlers/attendance-generator.service';
import { WorkScheduleGeneratorService } from './handlers/work-schedule-generator.service';
import { WorkScheduleModule } from '../payroll/work-schedule/work-schedule.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ScheduledTask]),
    forwardRef(() => AttendanceModule),
    forwardRef(() => WorkerModule),
    forwardRef(() => WorkScheduleModule),
  ],
  providers: [
    TaskSchedulerService,
    TaskRegistryService,
    TaskHandlerService,
    AttendanceGeneratorService,
    WorkScheduleGeneratorService,
  ],
  exports: [TaskSchedulerService],
})
export class TaskSchedulerModule {}
