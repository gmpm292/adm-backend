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
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
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
    this.assertValidRange(
      createWorkScheduleInput.startDate,
      createWorkScheduleInput.endDate,
      createWorkScheduleInput.workingDays,
    );
    // Sin oficina el horario es de toda la empresa (el generador anual)
    const office = createWorkScheduleInput.officeId
      ? await this.officeService.findOne(
          createWorkScheduleInput.officeId,
          cu,
          scopes,
          manager,
        )
      : undefined;

    const workSchedule: WorkSchedule = {
      ...createWorkScheduleInput,
      name: createWorkScheduleInput.name.trim(),
      office,
      business:
        office?.business ??
        (createWorkScheduleInput.businessId
          ? { id: createWorkScheduleInput.businessId }
          : undefined),
    } as WorkSchedule;

    return super.baseCreate({
      data: workSchedule,
      cu,
      scopes,
      manager,
    });
  }

  /** Fechas en orden y al menos un día laborable */
  private assertValidRange(
    startDate?: Date,
    endDate?: Date,
    workingDays?: WorkSchedule['workingDays'],
  ): void {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new BadRequestError(
        'La fecha de inicio no puede ser posterior a la de fin',
      );
    }
    if (workingDays && !Object.values(workingDays).some(Boolean)) {
      throw new BadRequestError('Marca al menos un día laborable');
    }
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
      relationsToLoad: ['office', 'business'],
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
        business: true,
        createdBy: true,
        updatedBy: true,
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

    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      id: _id,
      officeId,
      businessId,
      departmentId,
      teamId,
      ...rest
    } = updateWorkScheduleInput;
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const data: Partial<WorkSchedule> = { ...rest };
    if (rest.name !== undefined) data.name = rest.name.trim();

    // `null` deja el horario para toda la empresa; sin el campo no cambia
    if (officeId === null) {
      data.office = null as unknown as WorkSchedule['office'];
    } else if (officeId !== undefined) {
      data.office = await this.officeService.findOne(
        officeId,
        cu,
        scopes,
        manager,
      );
    }

    this.assertValidRange(
      data.startDate ?? workSchedule.startDate,
      data.endDate ?? workSchedule.endDate,
      data.workingDays,
    );

    return super.baseUpdate({
      id,
      data,
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
