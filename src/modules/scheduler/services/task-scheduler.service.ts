import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TaskRegistryService } from './task-registry.service';
import { TaskHandlerService } from './task-handler.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ScheduledTask } from '../entities/scheduled-task.entity';
import { CronJob } from 'cron';
import parser from 'cron-parser';
import { UpdateScheduledTaskInput } from '../dto/update-scheduled-task.input';
import { CreateScheduledTaskInput } from '../dto/create-scheduled-task.input';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';

@Injectable()
export class TaskSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TaskSchedulerService.name);
  private jobs = new Map<string, CronJob>();

  constructor(
    private readonly taskRegistry: TaskRegistryService,
    private readonly taskHandler: TaskHandlerService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultTasks(); // <-- inicializamos las tareas por defecto
    await this.initializeScheduledTasks(); // <-- cargamos las tareas existentes
  }

  private async initializeDefaultTasks() {
    const defaultTasks: CreateScheduledTaskInput[] = [
      // {
      //   name: 'Tarea cada 10 segundos',
      //   description: 'Tarea cada 10 segundos',
      //   handlerType: 'SOFT_DELETE_EXPIRED_RELATIONS',
      //   cronExpression: '*/10 * * * * *', // cada 10 segundos
      //   isActive: true,
      // },
      {
        name: 'Generar registros de asistencia diarios',
        description:
          'Crea registros de asistencia para todos los workers activos',
        handlerType: 'GENERATE_DAILY_ATTENDANCES',
        cronExpression: '0 2 * * *', // cada día a las 2:00 am
        isActive: true,
      },
      {
        name: 'Generar horarios de trabajo',
        description: 'Planifica los horarios de trabajo para el próximo año',
        handlerType: 'GENERATE_WORK_SCHEDULES',
        cronExpression: '0 0 1 * *', // Primer día de cada mes a medianoche
        isActive: true,
        isDefault: true,
      },
    ];

    // Obtener todas las tareas existentes en la base de datos
    const existingTasks = await this.taskRegistry.find({
      take: 100, // Número suficiente para todas las tareas
      filters: [
        {
          property: 'isDefault',
          operator: ConditionalOperator.EQUAL,
          value: 'true',
        },
      ],
    });

    // Crear un mapa de las tareas por defecto esperadas
    const expectedTaskKeys = new Map<string, string>();
    defaultTasks.forEach((task) => {
      const key = `${task.handlerType}-${task.cronExpression}`;
      expectedTaskKeys.set(key, task.name);
    });

    // Identificar tareas para crear y eliminar
    const tasksToCreate: CreateScheduledTaskInput[] = [];
    const tasksToDelete: number[] = [];

    // Verificar cada tarea existente
    for (const existingTask of existingTasks.data as Array<ScheduledTask>) {
      const existingKey = `${existingTask.handlerType}-${existingTask.cronExpression}`;

      if (!expectedTaskKeys.has(existingKey)) {
        // Esta tarea ya no está en las tareas por defecto, marcar para eliminar
        tasksToDelete.push(existingTask.id as number);
      } else {
        // Esta tarea existe, remover del mapa de esperadas
        expectedTaskKeys.delete(existingKey);
      }
    }

    // Las tareas restantes en expectedTaskKeys son las que necesitan ser creadas
    expectedTaskKeys.forEach((name, key) => {
      const [handlerType, cronExpression] = key.split('-');
      const taskToCreate = defaultTasks.find(
        (task) =>
          task.handlerType === handlerType &&
          task.cronExpression === cronExpression,
      );
      if (taskToCreate) {
        tasksToCreate.push(taskToCreate);
      }
    });

    // Ejecutar operaciones de eliminación
    if (tasksToDelete.length > 0) {
      for (const taskId of tasksToDelete) {
        await this.taskRegistry.remove([taskId]);
        this.logger.log(`Tarea por defecto eliminada: ${taskId}`);
      }
    }

    // Ejecutar operaciones de creación
    for (const taskInput of tasksToCreate) {
      const task = await this.taskRegistry.create({
        ...taskInput,
        isDefault: true, // Marcar como tarea por defecto
      });
      this.logger.log(`Tarea por defecto creada: ${task.name}`);
    }

    // Si no hay cambios, registrar
    if (tasksToCreate.length === 0 && tasksToDelete.length === 0) {
      this.logger.log('Todas las tareas por defecto están actualizadas');
    }
  }

  private async initializeScheduledTasks() {
    const tasks = await this.taskRegistry.getAllActiveTasks();
    tasks.forEach((task) => this.scheduleTask(task));
  }

  scheduleTask(task: ScheduledTask) {
    const job = new CronJob(task.cronExpression, async () => {
      await this.executeAndTrackTask(task);
    });

    this.schedulerRegistry.addCronJob(task.name, job);
    job.start();

    this.jobs.set(task.name, job);
    this.logger.log(`Tarea programada: ${task.name}`);
  }

  async executeAndTrackTask(task: ScheduledTask) {
    await this.taskHandler.executeTask(task);

    task.lastRun = new Date();
    try {
      const interval = parser.parse(task.cronExpression);
      task.nextRun = interval.next().toDate();
    } catch (err) {
      this.logger.error(
        `Invalid cron expression for task ${task.name}. Error: ${err}`,
      );
      task.nextRun = undefined;
    }

    try {
      await this.taskRegistry.update(
        task.id as number,
        task as UpdateScheduledTaskInput,
      );
    } catch (error) {
      console.log('Error in executeAndTrackTask: ', `${error}`);
    }
  }

  updateTask(task: ScheduledTask) {
    this.removeTask(task.name);
    this.scheduleTask(task);
  }

  removeTask(taskName: string) {
    if (this.jobs.has(taskName)) {
      const job = this.jobs.get(taskName);
      void job?.stop();
      this.schedulerRegistry.deleteCronJob(taskName);
      this.jobs.delete(taskName);
      this.logger.log(`Tarea eliminada: ${taskName}`);
    }
  }
}
