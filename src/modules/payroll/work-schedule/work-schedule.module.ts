import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkScheduleResolver } from './resolvers/work-schedule.resolver';
import { WorkScheduleService } from './services/work-schedule.service';
import { WorkSchedule } from './entities/work-schedule.entity';
import { OfficeModule } from '../../company/office/office.module';
import { Office } from '../../company/office/entities/co_office.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkSchedule, Office]),
    forwardRef(() => OfficeModule),
  ],
  providers: [WorkScheduleResolver, WorkScheduleService],
  exports: [WorkScheduleResolver, WorkScheduleService],
})
export class WorkScheduleModule {}
