import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, DeepPartial } from 'typeorm';
import { ScheduledTask } from '../entities/scheduled-task.entity';

import { CreateScheduledTaskInput } from '../dto/create-scheduled-task.input';
import { BaseService } from '../../../core/services/base.service';
import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../core/enums/scoped-access.enum';
import {
  ListOptions,
  ListSummary,
} from '../../../core/graphql/remote-operations';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { NotFoundError } from '../../../core/errors/appErrors/NotFoundError.error';
import { UpdateScheduledTaskInput } from '../dto/update-scheduled-task.input';

@Injectable()
export class TaskRegistryService extends BaseService<ScheduledTask> {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
    @InjectRepository(ScheduledTask)
    private readonly taskRepository: Repository<ScheduledTask>,
  ) {
    super(taskRepository);
  }

  async create(
    createTaskInput: CreateScheduledTaskInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScheduledTask> {
    // 🔎 Validar que no exista tarea con mismo handlerType y cronExpression
    await this.validateUniqueTask(createTaskInput, cu, scopes, manager);

    const task: DeepPartial<ScheduledTask> = {
      ...createTaskInput,
    };

    return super.baseCreate({
      data: task,
      cu,
      scopes,
      manager,
    });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return super.baseFind({ options, cu, scopes, manager });
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScheduledTask> {
    return super.baseFindOne({ id, cu, scopes, manager });
  }

  async getAllActiveTasks(): Promise<ScheduledTask[]> {
    return this.taskRepository.find({ where: { isActive: true } });
  }

  async update(
    id: number,
    updateTaskInput: UpdateScheduledTaskInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScheduledTask> {
    const task = await super.baseFindOne({ id, cu, scopes, manager });
    if (!task) {
      throw new NotFoundError('ScheduledTask not found');
    }

    const updateData: DeepPartial<ScheduledTask> = {
      ...updateTaskInput,
    };

    return super.baseUpdate({
      id,
      data: updateData,
      cu,
      scopes,
      manager,
    });
  }

  async remove(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ScheduledTask[]> {
    const tasks = await super.baseFindByIds({ ids, cu, scopes, manager });

    if (tasks.length === 0) {
      throw new NotFoundError('No ScheduledTasks found');
    }

    return super.baseDeleteMany({
      ids: tasks.map((t) => t.id) as number[],
      cu,
      scopes,
      softRemove: true,
      manager,
    });
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    return super.baseRestoreDeletedMany({
      ids,
      cu,
      scopes,
      manager,
    });
  }

  private async validateUniqueTask(
    createTaskInput: CreateScheduledTaskInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    const dataInDB = await this.baseFind({
      options: {
        take: 0,
        filters: [
          {
            property: 'handlerType',
            operator: ConditionalOperator.EQUAL,
            value: createTaskInput.handlerType,
          },
          {
            property: 'cronExpression',
            operator: ConditionalOperator.EQUAL,
            value: createTaskInput.cronExpression,
          },
        ],
      },
      cu,
      scopes,
      manager,
    });

    if (dataInDB.totalCount > 0) {
      console.log(
        `A task with same handlerType and cronExpression already exists`,
      );
    }

    return true;
  }
}
