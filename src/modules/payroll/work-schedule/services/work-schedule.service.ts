import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateWorkScheduleInput } from '../dto/create-work-schedule.input';
import { UpdateWorkScheduleInput } from '../dto/update-work-schedule.input';
import { BaseService } from '../../../../core/services/base.service';
import { WorkSchedule } from '../entities/work-schedule.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { OfficeService } from '../../../company/office/services/office.service';

@Injectable()
export class WorkScheduleService extends BaseService<WorkSchedule> {
  constructor(
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
    @Inject(forwardRef(() => OfficeService))
    private officeService: OfficeService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(workScheduleRepository);
  }

  async create(
    createWorkScheduleInput: CreateWorkScheduleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkSchedule> {
    const office = await this.officeService.findOne(
      createWorkScheduleInput.officeId as number,
      cu,
      scopes,
      manager,
    );
    if (!office) {
      throw new NotFoundError('Office not found');
    }

    const workSchedule: WorkSchedule = {
      ...createWorkScheduleInput,
      office,
    } as WorkSchedule;

    return super.baseCreate({
      data: workSchedule,
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
    return await super.baseFind({
      options,
      relationsToLoad: ['office'],
      cu,
      scopes,
      manager,
    });
  }

  async findOne(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkSchedule> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        office: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findByOffice(
    officeId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkSchedule[]> {
    await this.officeService.findOne(officeId, cu, scopes, manager);
    return this.workScheduleRepository.find({
      where: { office: { id: officeId } },
      relations: ['office'],
      order: { startDate: 'DESC' },
    });
  }

  async update(
    id: number,
    updateWorkScheduleInput: UpdateWorkScheduleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkSchedule> {
    const workSchedule = await super.baseFindOne({ id, cu, scopes, manager });
    if (!workSchedule) {
      throw new NotFoundError();
    }

    if (updateWorkScheduleInput.officeId) {
      const office = await this.officeService.findOne(
        updateWorkScheduleInput.officeId,
        cu,
        scopes,
        manager,
      );
      if (!office) {
        throw new NotFoundError('Office not found');
      }
      workSchedule.office = office;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { officeId, ...rest } = updateWorkScheduleInput;
    return super.baseUpdate({
      id,
      data: { ...workSchedule, ...rest },
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
  ): Promise<WorkSchedule[]> {
    return super.baseDeleteMany({
      ids,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  async restore(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    return super.baseRestoreDeletedMany({
      ids,
      cu,
      scopes,
      manager,
    });
  }
}
