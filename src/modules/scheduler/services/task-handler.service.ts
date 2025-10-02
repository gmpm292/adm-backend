/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { ScheduledTask } from '../entities/scheduled-task.entity';
import { AttendanceGeneratorService } from '../handlers/attendance-generator.service';
import { WorkScheduleGeneratorService } from '../handlers/work-schedule-generator.service';

@Injectable()
export class TaskHandlerService {
  private readonly logger = new Logger(TaskHandlerService.name);
  private readonly taskHandlers = new Map<string, () => Promise<void>>();

  constructor(
    private readonly attendanceGeneratorService: AttendanceGeneratorService,
    private workScheduleGeneratorService: WorkScheduleGeneratorService,
  ) {
    this.registerHandlers();
  }

  private registerHandlers() {
    this.taskHandlers.set(
      'GENERATE_DAILY_ATTENDANCES',
      this.generateWorkSchedules.bind(this),
    );
  }

  async executeTask(task: ScheduledTask): Promise<void> {
    const handler = this.taskHandlers.get(task.handlerType);

    if (!handler) {
      this.logger.warn(`No handler found for task type: ${task.handlerType}`);
      return;
    }

    try {
      await handler();
      this.logger.log(`Task executed successfully: ${task.name}`);
    } catch (err) {
      this.logger.error(
        `Error executing task ${task.name}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async generateWorkSchedules() {
    return this.workScheduleGeneratorService.verifyAndCompleteNextYearPlanning();
  }
}
