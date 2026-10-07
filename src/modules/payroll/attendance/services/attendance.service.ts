import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  Brackets,
  EntityManager,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateAttendanceInput } from '../dto/create-attendance.input';
import { UpdateAttendanceInput } from '../dto/update-attendance.input';
import { BaseService } from '../../../../core/services/base.service';
import { Attendance } from '../entities/attendance.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { WorkerService } from '../../worker/services/worker.service';
import { WorkScheduleService } from '../../work-schedule/services/work-schedule.service';
import { WorkSchedule } from '../../work-schedule/entities/work-schedule.entity';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { Worker } from '../../worker/entities/worker.entity';

const WEEK_DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/**
 * Asistencia diaria de cada trabajador. La tarea programada abre el registro
 * del día como ausente; al anotar la hora de entrada pasa a presente, y con
 * la de salida se calculan las horas trabajadas.
 */
@Injectable()
export class AttendanceService extends BaseService<Attendance> {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    protected scopedAccessService: ScopedAccessService,
    @Inject(forwardRef(() => WorkerService))
    private workerService: WorkerService,
    @Inject(forwardRef(() => WorkScheduleService))
    private workScheduleService: WorkScheduleService,
  ) {
    super(attendanceRepository);
  }

  async create(
    createAttendanceInput: CreateAttendanceInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance> {
    const { workerId, workScheduleId, ...rest } = createAttendanceInput;
    const worker = await this.workerService.findOne(
      workerId,
      cu,
      scopes,
      manager,
    );
    const workSchedule = workScheduleId
      ? await this.workScheduleService.findOne(
          workScheduleId,
          cu,
          scopes,
          manager,
        )
      : undefined;

    const attendanceDate = new Date(createAttendanceInput.attendanceDate);
    this.assertNotFuture(attendanceDate);
    await this.assertNoOtherRecord(worker, attendanceDate, undefined, manager);

    const checkInTime = this.normalizeTime(rest.checkInTime, 'entrada');
    const checkOutTime = this.normalizeTime(rest.checkOutTime, 'salida');
    const attendance = {
      ...rest,
      checkInTime,
      checkOutTime,
      worker,
      workSchedule,
      status: this.statusFor(rest.status, AttendanceStatus.ABSENT, checkInTime),
      hoursWorked: this.hoursFor(rest.hoursWorked, checkInTime, checkOutTime),
      isHoliday: rest.isHoliday ?? false,
      isPaid: false,
      // El registro hereda el lugar del trabajador
      business: worker.business,
      office: worker.office,
      department: worker.department,
      team: worker.team,
    } as Attendance;

    return super.baseCreate({
      data: attendance,
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
      relationsToLoad: [
        'worker',
        'worker.user',
        'workSchedule',
        'business',
        'office',
        'department',
        'team',
      ],
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
  ): Promise<Attendance> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        worker: { user: true },
        workSchedule: true,
        business: true,
        office: true,
        department: true,
        team: true,
        createdBy: true,
        updatedBy: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async findDailyAttendance(
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance[]> {
    const day = this.getLocalDateString(new Date(date));
    const result = await super.baseFind({
      options: {
        filters: this.dayFilters(day, day),
        skip: 0,
      },
      relationsToLoad: ['worker', 'workSchedule'],
      cu,
      scopes,
      manager,
    });
    return result.data as Attendance[];
  }

  async findWorkerAttendance(
    workerId: number,
    startDate: Date,
    endDate: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance[]> {
    await this.workerService.findOne(workerId, cu, scopes, manager);
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestError(
        'La fecha de inicio no puede ser posterior a la de fin',
      );
    }

    const result = await super.baseFind({
      options: {
        filters: [
          {
            property: 'worker.id',
            operator: ConditionalOperator.EQUAL,
            value: workerId.toString(),
          },
          // Hasta el final del último día, no hasta su medianoche
          ...this.dayFilters(
            this.getLocalDateString(new Date(startDate)),
            this.getLocalDateString(new Date(endDate)),
          ),
        ],
        skip: 0,
      },
      relationsToLoad: ['worker', 'workSchedule'],
      cu,
      scopes,
      manager,
    });
    return result.data as Attendance[];
  }

  /** Marca registros completos como pagados, todos o ninguno */
  async markAsPaid(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance[]> {
    if (!manager) {
      return this.attendanceRepository.manager.transaction((txManager) =>
        this.markAsPaid(ids, cu, scopes, txManager),
      );
    }
    if (!ids?.length) {
      throw new BadRequestError('Indica qué registros marcar como pagados');
    }

    const attendances = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
    });
    if (
      attendances.some((a) => !a.checkOutTime || Number(a.hoursWorked) <= 0)
    ) {
      throw new BadRequestError(
        'Solo se pagan registros con entrada, salida y horas trabajadas',
      );
    }

    const updated: Attendance[] = [];
    for (const attendance of attendances) {
      updated.push(
        await super.baseUpdate({
          id: attendance.id as number,
          data: { isPaid: true },
          cu,
          scopes,
          manager,
        }),
      );
    }
    return updated;
  }

  async update(
    id: number,
    updateAttendanceInput: UpdateAttendanceInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance> {
    const attendance = await super.baseFindOne({
      id,
      relationsToLoad: { worker: true, workSchedule: true },
      cu,
      scopes,
      manager,
    });
    if (attendance.isPaid) {
      throw new BadRequestError('Un registro ya pagado no se modifica');
    }

    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      id: _id,
      workerId,
      workScheduleId,
      // El lugar viene del trabajador, no se edita aparte
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      businessId,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      officeId,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      departmentId,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      teamId,
      ...rest
    } = updateAttendanceInput;
    const data: Partial<Attendance> = { ...rest };

    let worker = attendance.worker;
    if (workerId && workerId !== attendance.worker?.id) {
      worker = await this.workerService.findOne(workerId, cu, scopes, manager);
      Object.assign(data, {
        worker,
        business: worker.business,
        office: worker.office,
        department: worker.department,
        team: worker.team,
      });
    }
    if (workScheduleId === null) {
      data.workSchedule = null as unknown as WorkSchedule;
    } else if (workScheduleId !== undefined) {
      data.workSchedule = await this.workScheduleService.findOne(
        workScheduleId,
        cu,
        scopes,
        manager,
      );
    }

    const attendanceDate = rest.attendanceDate
      ? new Date(rest.attendanceDate)
      : attendance.attendanceDate;
    if (rest.attendanceDate) this.assertNotFuture(attendanceDate);
    if (rest.attendanceDate || data.worker) {
      await this.assertNoOtherRecord(worker, attendanceDate, id, manager);
    }

    const checkInTime =
      rest.checkInTime !== undefined
        ? this.normalizeTime(rest.checkInTime, 'entrada')
        : attendance.checkInTime;
    const checkOutTime =
      rest.checkOutTime !== undefined
        ? this.normalizeTime(rest.checkOutTime, 'salida')
        : attendance.checkOutTime;
    data.checkInTime = (checkInTime ?? null) as string;
    data.checkOutTime = (checkOutTime ?? null) as string;
    data.status = this.statusFor(rest.status, attendance.status, checkInTime);
    // Las horas salen de entrada y salida; a mano solo si faltan ambas
    data.hoursWorked = this.hoursFor(
      rest.hoursWorked ?? Number(attendance.hoursWorked),
      checkInTime,
      checkOutTime,
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
  ): Promise<Attendance[]> {
    const attendances = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
    });
    if (attendances.some((a) => a.isPaid)) {
      throw new BadRequestError('Un registro ya pagado no se elimina');
    }

    return super.baseDeleteMany({
      ids: attendances.map((a) => a.id) as Array<number>,
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

  // ========== Apoyo ==========

  public async findDailyAttendanceForWorker(
    workerId: number,
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance | null> {
    const day = this.getLocalDateString(date);
    const result = await super.baseFind({
      options: {
        filters: [
          {
            property: 'worker.id',
            operator: ConditionalOperator.EQUAL,
            value: workerId.toString(),
          },
          ...this.dayFilters(day, day),
        ],
        take: 1,
      },
      relationsToLoad: ['worker', 'workSchedule'],
      cu,
      scopes,
      manager,
    });

    const attendances = result.data as Attendance[];
    return attendances.length > 0 ? attendances[0] : null;
  }

  /** Si al trabajador le toca trabajar ese día según su horario */
  public async shouldWorkToday(
    workerId: number,
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    const worker = await this.workerService.findOne(
      workerId,
      cu,
      scopes,
      manager,
    );
    const schedule = await this.scheduleFor(worker, date, manager);
    // Sin horario se asume que trabaja (salvo el domingo, que no se genera)
    return schedule ? !!schedule.workingDays[WEEK_DAYS[date.getDay()]] : true;
  }

  /**
   * Si el trabajador cuenta para el reparto de ese día: solo con un registro
   * en estado presente (o tarde: vino igualmente).
   */
  public async shouldCountForProfitSharing(
    workerId: number,
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    try {
      const attendance = await this.findDailyAttendanceForWorker(
        workerId,
        date,
        cu,
        scopes,
        manager,
      );
      return (
        !!attendance &&
        attendance.countsForProfitSharing &&
        [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(
          attendance.status,
        )
      );
    } catch {
      // Ante la duda, no cuenta
      return false;
    }
  }

  /** Aún no hay calendario de festivos */
  public isHoliday(date: Date): boolean {
    void date;
    return false;
  }

  public getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Horario que cubre esa fecha: el de su oficina o, si no, el de la empresa */
  private async scheduleFor(
    worker: Worker,
    date: Date,
    manager?: EntityManager,
  ): Promise<WorkSchedule | null> {
    const repository =
      manager?.getRepository(WorkSchedule) ??
      this.workScheduleService.getRepository();
    const day = this.getLocalDateString(date);
    const covering = {
      startDate: LessThanOrEqual(new Date(`${day}T23:59:59`)),
      endDate: MoreThanOrEqual(new Date(`${day}T00:00:00`)),
    };
    if (worker.office?.id) {
      const own = await repository.findOne({
        where: { ...covering, office: { id: worker.office.id } },
        order: { startDate: 'DESC' },
      });
      if (own) return own;
    }
    if (!worker.business?.id) return null;
    return repository.findOne({
      where: {
        ...covering,
        office: IsNull(),
        business: { id: worker.business.id },
      },
      order: { startDate: 'DESC' },
    });
  }

  /** Filtros de un rango de días completos (del primero al último) */
  private dayFilters(fromDay: string, toDay: string) {
    return [
      {
        property: 'attendanceDate',
        operator: ConditionalOperator.GREATER_EQUAL_THAN,
        value: `${fromDay} 00:00:00`,
      },
      {
        property: 'attendanceDate',
        operator: ConditionalOperator.LESS_EQUAL_THAN,
        value: `${toDay} 23:59:59.999`,
      },
    ];
  }

  private assertNotFuture(date: Date): void {
    if (this.getLocalDateString(date) > this.getLocalDateString(new Date())) {
      throw new BadRequestError('La fecha no puede ser futura');
    }
  }

  /** Un solo registro por trabajador y día */
  private async assertNoOtherRecord(
    worker: Worker,
    date: Date,
    exceptId: number | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    const day = this.getLocalDateString(date);
    const repository =
      manager?.getRepository(Attendance) ?? this.attendanceRepository;
    const query = repository
      .createQueryBuilder('attendance')
      .where('"attendance"."workerId" = :workerId', { workerId: worker.id })
      .andWhere(
        new Brackets((qb) =>
          qb
            .where('attendance.attendanceDate >= :from', {
              from: `${day} 00:00:00`,
            })
            .andWhere('attendance.attendanceDate <= :to', {
              to: `${day} 23:59:59.999`,
            }),
        ),
      );
    if (exceptId) query.andWhere('attendance.id != :exceptId', { exceptId });
    if (await query.getCount()) {
      throw new ConflictError(
        'Ese trabajador ya tiene un registro de asistencia ese día',
      );
    }
  }

  /** «8:5», «08:05» o «08:05:00» → «08:05:00»; vacío → sin hora */
  private normalizeTime(
    value: string | null | undefined,
    label: string,
  ): string | undefined {
    if (value === undefined || value === null || value.trim() === '') {
      return undefined;
    }
    const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(value.trim());
    const [hours, minutes, seconds] = match
      ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)]
      : [NaN, NaN, NaN];
    if (!(hours < 24 && minutes < 60 && seconds < 60)) {
      throw new BadRequestError(
        `La hora de ${label} no es válida: usa el formato 08:30`,
      );
    }
    const two = (n: number) => n.toString().padStart(2, '0');
    return `${two(hours)}:${two(minutes)}:${two(seconds)}`;
  }

  /** Con hora de entrada, un registro «ausente» pasa a «presente» */
  private statusFor(
    requested: AttendanceStatus | undefined,
    current: AttendanceStatus,
    checkInTime: string | undefined,
  ): AttendanceStatus {
    const status = requested ?? current;
    return checkInTime && status === AttendanceStatus.ABSENT
      ? AttendanceStatus.PRESENT
      : status;
  }

  /** Horas entre entrada y salida (turnos que pasan la medianoche incluidos) */
  private hoursFor(
    manual: number | undefined,
    checkInTime: string | undefined,
    checkOutTime: string | undefined,
  ): number {
    if (!checkInTime || !checkOutTime) {
      return checkInTime || checkOutTime ? 0 : Math.max(manual ?? 0, 0);
    }
    const seconds = (time: string) => {
      const [h, m, s] = time.split(':').map(Number);
      return h * 3600 + m * 60 + (s || 0);
    };
    let total = seconds(checkOutTime) - seconds(checkInTime);
    if (total < 0) total += 24 * 3600;
    return Math.round((total / 3600) * 100) / 100;
  }
}
