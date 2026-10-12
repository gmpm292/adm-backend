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

/**
 * Programa en memoria (cron) las tareas guardadas en `scheduled_task`. Al
 * arrancar sincroniza las tareas por defecto y programa las activas.
 */
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

  /**
   * Deja en la base exactamente las tareas por defecto de esta lista: crea las
   * que faltan y elimina (borrado lógico) las marcadas `isDefault` que ya no
   * están. Se identifican por `handlerType` + `cronExpression`, así que
   * cambiar aquí la hora de una tarea la sustituye por otra.
   */
  private async initializeDefaultTasks() {
    const defaultTasks: CreateScheduledTaskInput[] = [
      {
        name: 'Generar registros de asistencia diarios',
        description:
          'Crea registros de asistencia para todos los workers activos',
        handlerType: 'GENERATE_DAILY_ATTENDANCES',
        // 06:00 UTC = 01:00-02:00 en Cuba: la fecha UTC ya es la del día local
        cronExpression: '0 6 * * *',
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
    const expectedTaskKeys = new Map<string, CreateScheduledTaskInput>();
    defaultTasks.forEach((task) => {
      const key = `${task.handlerType}-${task.cronExpression}`;
      expectedTaskKeys.set(key, task);
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
    tasksToCreate.push(...expectedTaskKeys.values());

    // Ejecutar operaciones de eliminación
    if (tasksToDelete.length > 0) {
      for (const taskId of tasksToDelete) {
        await this.taskRegistry.remove([taskId]);
        this.logger.log(`Tarea por defecto eliminada: ${taskId}`);
      }
    }

    // Ejecutar operaciones de creación
    for (const taskInput of tasksToCreate) {
      try {
        const task = await this.taskRegistry.create({
          ...taskInput,
          isDefault: true, // Marcar como tarea por defecto
        });
        this.logger.log(`Tarea por defecto creada: ${task.name}`);
      } catch (error) {
        // Ya hay una tarea creada a mano con el mismo handler y cron.
        this.logger.warn(
          `Tarea por defecto no creada (${taskInput.name}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
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

  /**
   * Crea y arranca el cron de la tarea si está activa. Se registra por su id
   * (`scheduled-task-<id>`), así dos tareas con el mismo nombre no chocan en
   * `SchedulerRegistry`; si ya estaba programada, se sustituye.
   */
  scheduleTask(task: ScheduledTask) {
    this.removeTask(task.id as number);
    if (!task.isActive) return;

    const job = new CronJob(task.cronExpression, async () => {
      await this.executeAndTrackTask(task);
    });

    const jobKey = this.jobKey(task.id as number);
    this.schedulerRegistry.addCronJob(jobKey, job);
    job.start();

    this.jobs.set(jobKey, job);
    this.logger.log(`Tarea programada: ${task.name}`);
  }

  private jobKey(taskId: number): string {
    return `scheduled-task-${taskId}`;
  }

  /**
   * Ejecuta la tarea y guarda `lastRun` y `nextRun`. Los errores del handler
   * los registra `TaskHandlerService` y no detienen el cron.
   */
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
      this.logger.error(
        `Error al guardar la ejecución de ${task.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Reprograma la tarea con sus datos nuevos (para y rehace el cron); si
   * quedó inactiva, solo la para.
   */
  updateTask(task: ScheduledTask) {
    this.scheduleTask(task);
  }

  /** Para el cron de la tarea con ese id; si no está programada, nada. */
  removeTask(taskId: number) {
    const jobKey = this.jobKey(taskId);
    const job = this.jobs.get(jobKey);
    if (job) {
      void job.stop();
      this.schedulerRegistry.deleteCronJob(jobKey);
      this.jobs.delete(jobKey);
      this.logger.log(`Tarea detenida: ${taskId}`);
    }
  }
}
