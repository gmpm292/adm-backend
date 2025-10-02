import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateAttendanceInput } from '../dto/create-attendance.input';
import { UpdateAttendanceInput } from '../dto/update-attendance.input';
import { BaseService } from '../../../../core/services/base.service';
import { Attendance } from '../entities/attendance.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { WorkerService } from '../../worker/services/worker.service';
import { WorkScheduleService } from '../../work-schedule/services/work-schedule.service';
import { WorkSchedule } from '../../work-schedule/entities/work-schedule.entity';
import { WorkerType } from '../../worker/enums/worker-type.enum';

interface CheckInInput {
  workerId: number;
  time?: string;
  notes?: string;
}

interface CheckOutInput {
  workerId: number;
  time?: string;
  notes?: string;
}

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

    // Validar y obtener el trabajador
    const worker = await this.workerService.findOne(
      workerId,
      cu,
      scopes,
      manager,
    );
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    // Validar y obtener el horario de trabajo si se proporciona
    let workSchedule: WorkSchedule | undefined;
    if (workScheduleId) {
      workSchedule = await this.workScheduleService.findOne(
        workScheduleId,
        cu,
        scopes,
        manager,
      );
      if (!workSchedule) {
        throw new NotFoundError('Work schedule not found');
      }
    }

    // Validar que la fecha de asistencia no sea futura
    if (new Date(createAttendanceInput.attendanceDate) > new Date()) {
      throw new Error('Attendance date cannot be in the future');
    }

    const attendance: Attendance = {
      ...rest,
      worker,
      workSchedule,
      status: createAttendanceInput.status || AttendanceStatus.ABSENT,
      hoursWorked: createAttendanceInput.hoursWorked || 0,
      isHoliday: createAttendanceInput.isHoliday || false,
      isPaid: false,
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
      relationsToLoad: ['worker'],
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
      relationsToLoad: { worker: true, workSchedule: true },
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
    const dateString = this.getLocalDateString(date);

    const result = await super.baseFind({
      options: {
        filters: [
          {
            property: 'attendanceDate',
            operator: ConditionalOperator.EQUAL,
            value: dateString,
          },
        ],
        take: 0,
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
    // Validar que el worker existe
    const worker = await this.workerService.findOne(
      workerId,
      cu,
      scopes,
      manager,
    );
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    // Validar fechas
    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    const result = await super.baseFind({
      options: {
        filters: [
          {
            property: 'worker.id',
            operator: ConditionalOperator.EQUAL,
            value: workerId.toString(),
          },
          {
            property: 'attendanceDate',
            operator: ConditionalOperator.GREATER_EQUAL_THAN,
            value: this.getLocalDateString(startDate),
          },
          {
            property: 'attendanceDate',
            operator: ConditionalOperator.LESS_EQUAL_THAN,
            value: this.getLocalDateString(endDate),
          },
        ],
        take: 0, // Get all records
      },
      relationsToLoad: ['worker', 'workSchedule'],
      cu,
      scopes,
      manager,
    });

    return result.data as Attendance[];
  }

  async checkIn(
    checkInInput: CheckInInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance> {
    // Validaciones
    if (!checkInInput.workerId || checkInInput.workerId <= 0) {
      throw new Error('Invalid worker ID');
    }

    const today = new Date();

    // Verificar si el worker existe
    const worker = await this.workerService.findOne(
      checkInInput.workerId,
      cu,
      scopes,
      manager,
    );
    if (!worker) {
      throw new NotFoundError('Worker not found');
    }

    // Buscar asistencia existente para hoy
    const existingAttendance = await this.findDailyAttendanceForWorker(
      checkInInput.workerId,
      today,
      cu,
      scopes,
      manager,
    );

    const checkInTime = checkInInput.time || this.getCurrentTimeString();

    if (existingAttendance) {
      // Si ya existe registro, actualizarlo
      if (existingAttendance.checkInTime) {
        throw new Error('Already checked in for today');
      }

      return super.baseUpdate({
        id: existingAttendance.id as number,
        data: {
          ...existingAttendance,
          checkInTime,
          status: await this.calculateStatus(
            checkInInput.workerId,
            today,
            checkInTime,
            cu,
            scopes,
            manager,
          ),
          notes: checkInInput.notes || existingAttendance.notes,
        },
        cu,
        scopes,
        manager,
      });
    }

    // Crear nuevo registro de asistencia
    const workSchedule = await this.getWorkerSchedule(
      checkInInput.workerId,
      today,
      cu,
      scopes,
      manager,
    );

    const isHoliday = this.isHoliday(today, cu, scopes, manager);
    const shouldWork = await this.shouldWorkToday(
      checkInInput.workerId,
      today,
      cu,
      scopes,
      manager,
    );

    const status = shouldWork
      ? await this.calculateStatus(
          checkInInput.workerId,
          today,
          checkInTime,
          cu,
          scopes,
          manager,
        )
      : AttendanceStatus.ABSENT;

    const attendanceData: CreateAttendanceInput = {
      workerId: checkInInput.workerId,
      attendanceDate: today,
      checkInTime,
      status,
      notes: checkInInput.notes,
      hoursWorked: 0,
      isHoliday,
      workScheduleId: workSchedule?.id,
    };

    return this.create(attendanceData, cu, scopes, manager);
  }

  async checkOut(
    checkOutInput: CheckOutInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance> {
    // Validaciones
    if (!checkOutInput.workerId || checkOutInput.workerId <= 0) {
      throw new Error('Invalid worker ID');
    }

    const today = new Date();

    // Buscar registro de asistencia de hoy
    const attendance = await this.findDailyAttendanceForWorker(
      checkOutInput.workerId,
      today,
      cu,
      scopes,
      manager,
    );

    if (!attendance) {
      throw new NotFoundError('No attendance record found for today');
    }

    if (!attendance.checkInTime) {
      throw new Error('Cannot check out without check-in time');
    }

    if (attendance.checkOutTime) {
      throw new Error('Already checked out for today');
    }

    const checkOutTime = checkOutInput.time || this.getCurrentTimeString();

    // Calcular horas trabajadas
    const hoursWorked = this.calculateHoursWorked(
      attendance.checkInTime,
      checkOutTime,
    );

    // Calcular nuevo estado
    const newStatus = this.calculateCheckOutStatus(
      attendance.status,
      checkOutTime,
      attendance.checkInTime,
    );

    return super.baseUpdate({
      id: attendance.id as number,
      data: {
        ...attendance,
        checkOutTime,
        hoursWorked,
        status: newStatus,
        notes: checkOutInput.notes || attendance.notes,
      },
      cu,
      scopes,
      manager,
    });
  }

  async markAsPaid(
    ids: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance[]> {
    if (!ids || ids.length === 0) {
      throw new Error('No attendance IDs provided');
    }

    const attendances = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
    });

    if (attendances.length === 0) {
      throw new NotFoundError('No attendance records found');
    }

    // Verificar que todos los registros tengan check-out
    const incompleteAttendances = attendances.filter(
      (a) => !a.checkOutTime || a.hoursWorked <= 0,
    );
    if (incompleteAttendances.length > 0) {
      throw new Error('Cannot mark incomplete attendance records as paid');
    }

    const updatedAttendances = await Promise.all(
      attendances.map((attendance) =>
        super.baseUpdate({
          id: attendance.id as number,
          data: { ...attendance, isPaid: true },
          cu,
          scopes,
          manager,
        }),
      ),
    );

    return updatedAttendances;
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

    if (!attendance) {
      throw new NotFoundError('Attendance record not found');
    }

    if (attendance.isPaid) {
      throw new Error('Cannot modify paid attendance record');
    }

    // Validar y actualizar el trabajador si se proporciona
    if (updateAttendanceInput.workerId) {
      const worker = await this.workerService.findOne(
        updateAttendanceInput.workerId,
        cu,
        scopes,
        manager,
      );
      if (!worker) {
        throw new NotFoundError('Worker not found');
      }
      attendance.worker = worker;
    }

    // Validar y actualizar el horario de trabajo si se proporciona
    if (updateAttendanceInput.workScheduleId) {
      const workSchedule = await this.workScheduleService.findOne(
        updateAttendanceInput.workScheduleId,
        cu,
        scopes,
        manager,
      );
      if (!workSchedule) {
        throw new NotFoundError('Work schedule not found');
      }
      attendance.workSchedule = workSchedule;
    }

    // Validar que la fecha de asistencia no sea futura
    if (
      updateAttendanceInput.attendanceDate &&
      new Date(updateAttendanceInput.attendanceDate) > new Date()
    ) {
      throw new Error('Attendance date cannot be in the future');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { workerId, workScheduleId, ...rest } = updateAttendanceInput;

    return super.baseUpdate({
      id,
      data: { ...attendance, ...rest },
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
    if (!ids || ids.length === 0) {
      throw new Error('No attendance IDs provided');
    }

    const attendances = await super.baseFindByIds({
      ids,
      cu,
      scopes,
      manager,
    });

    if (attendances.length === 0) {
      throw new NotFoundError('No attendance records found');
    }

    // Check if any attendance is already paid
    const paidAttendances = attendances.filter((a) => a.isPaid);
    if (paidAttendances.length > 0) {
      throw new Error('Cannot delete paid attendance records');
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
    if (!ids || ids.length === 0) {
      throw new Error('No attendance IDs provided');
    }

    return super.baseRestoreDeletedMany({
      ids,
      cu,
      scopes,
      manager,
    });
  }

  // ========== MÉTODOS AUXILIARES ==========

  public async findDailyAttendanceForWorker(
    workerId: number,
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Attendance | null> {
    const dateString = this.getLocalDateString(date);

    const result = await super.baseFind({
      options: {
        filters: [
          {
            property: 'worker.id',
            operator: ConditionalOperator.EQUAL,
            value: workerId.toString(),
          },
          {
            property: 'attendanceDate',
            operator: ConditionalOperator.EQUAL,
            value: dateString,
          },
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

  private async calculateStatus(
    workerId: number,
    date: Date,
    checkInTime: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<AttendanceStatus> {
    // Obtener horario del worker
    const workSchedule = await this.getWorkerSchedule(
      workerId,
      date,
      cu,
      scopes,
      manager,
    );

    if (!workSchedule) {
      return AttendanceStatus.PRESENT;
    }

    // Verificar si es día festivo
    const isHoliday = this.isHoliday(date, cu, scopes, manager);
    if (isHoliday) {
      return AttendanceStatus.PRESENT; // O podría ser un estado especial para festivos
    }

    // Obtener hora de entrada esperada del horario
    // Esto depende de cómo esté estructurado tu WorkSchedule
    // Por ahora, usamos una lógica simple
    const [hours, minutes] = checkInTime.split(':').map(Number);
    const checkInTotalMinutes = hours * 60 + minutes;

    // Hora de entrada esperada (ej: 8:00 AM = 480 minutos)
    const expectedStartTime = 8 * 60; // 8:00 AM en minutos

    if (checkInTotalMinutes > expectedStartTime + 15) {
      // 15 minutos de tolerancia
      return AttendanceStatus.LATE;
    }

    return AttendanceStatus.PRESENT;
  }

  private calculateCheckOutStatus(
    currentStatus: AttendanceStatus,
    checkOutTime: string,
    checkInTime: string,
  ): AttendanceStatus {
    const [outHours, outMinutes] = checkOutTime.split(':').map(Number);
    const [inHours, inMinutes] = checkInTime.split(':').map(Number);

    const checkOutTotalMinutes = outHours * 60 + outMinutes;
    const checkInTotalMinutes = inHours * 60 + inMinutes;

    // Jornada laboral mínima esperada (8 horas = 480 minutos)
    const minWorkMinutes = 480;
    const actualWorkMinutes = checkOutTotalMinutes - checkInTotalMinutes;

    if (
      actualWorkMinutes < minWorkMinutes &&
      currentStatus === AttendanceStatus.PRESENT
    ) {
      return AttendanceStatus.EARLY_DEPARTURE;
    }

    return currentStatus;
  }

  private calculateHoursWorked(
    checkInTime: string, // Formato: '08:30:00'
    checkOutTime: string, // Formato: '17:45:00'
  ): number {
    if (!checkInTime || !checkOutTime) return 0;

    const [inHours, inMinutes, inSeconds] = checkInTime.split(':').map(Number);
    const [outHours, outMinutes, outSeconds] = checkOutTime
      .split(':')
      .map(Number);

    let totalSeconds =
      outHours * 3600 +
      outMinutes * 60 +
      outSeconds -
      (inHours * 3600 + inMinutes * 60 + inSeconds);

    // Manejar turnos nocturnos
    if (totalSeconds < 0) {
      totalSeconds += 24 * 3600; // Agregar 24 horas en segundos
    }

    // Convertir a horas con 2 decimales
    const hours = totalSeconds / 3600;
    return Math.round(hours * 100) / 100;
  }

  public getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getCurrentTimeString(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`; // ✅ Formato HH:MM:SS
  }

  private async getWorkerSchedule(
    workerId: number,
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<WorkSchedule | null> {
    // Implementar lógica para obtener el horario del worker para la fecha específica
    // Esto puede involucrar buscar en workSchedules activos para el worker
    try {
      // Ejemplo simplificado - deberías implementar la lógica real según tu estructura
      const worker = await this.workerService.findOne(
        workerId,
        cu,
        scopes,
        manager,
      );
      if (worker && worker.paymentRule) {
        // Buscar horarios asociados al worker
        return null; // Implementar lógica real
      }
      return null;
    } catch {
      return null;
    }
  }

  public async shouldWorkToday(
    workerId: number,
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    // Verificar si el worker debería trabajar hoy según su horario
    const workSchedule = await this.getWorkerSchedule(
      workerId,
      date,
      cu,
      scopes,
      manager,
    );

    if (!workSchedule) {
      return true; // Asumir que trabaja si no tiene horario definido
    }

    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const workingDays = workSchedule.workingDays;

    switch (dayOfWeek) {
      case 0:
        return workingDays.sunday;
      case 1:
        return workingDays.monday;
      case 2:
        return workingDays.tuesday;
      case 3:
        return workingDays.wednesday;
      case 4:
        return workingDays.thursday;
      case 5:
        return workingDays.friday;
      case 6:
        return workingDays.saturday;
      default:
        return false;
    }
  }

  /**
   * Determina si un trabajador debe contar para la repartición de ganancias del día
   * basado en su registro de asistencia y reglas de negocio configuradas.
   *
   * @param workerId - ID del trabajador a evaluar
   * @param date - Fecha para la cual se verifica la elegibilidad
   * @param cu - Payload del usuario autenticado (opcional)
   * @param scopes - Scopes de acceso (opcional)
   * @param manager - EntityManager para transacciones (opcional)
   * @returns Promise<boolean> - true si el trabajador cuenta para repartición, false en caso contrario
   *
   * @example
   * // Verificar si un worker cuenta para repartición hoy
   * const shouldCount = await attendanceService.shouldCountForProfitSharing(123, new Date());
   *
   * @businessRules
   * - Solo trabajadores con estado PRESENTE cuentan
   * - Debe tener un registro de asistencia válido para la fecha
   *
   */
  public async shouldCountForProfitSharing(
    workerId: number,
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<boolean> {
    try {
      // 1. Verificar que el worker existe y está activo
      const worker = await this.workerService.findOne(
        workerId,
        cu,
        scopes,
        manager,
      );

      if (!worker) {
        console.warn(`Worker with ID ${workerId} not found`);
        return false;
      }

      // 2. Buscar el registro de asistencia para la fecha especificada
      const attendance = await this.findDailyAttendanceForWorker(
        workerId,
        date,
        cu,
        scopes,
        manager,
      );

      if (!attendance) {
        console.warn(
          `No attendance record found for worker ${workerId} on date ${date.toISOString()}`,
        );
        return false;
      }

      // 3. Solo cuentan asistencias con estado PRESENTE
      if (attendance.status !== AttendanceStatus.PRESENT) {
        console.log(
          `Worker ${workerId} has status ${attendance.status}, not eligible for profit sharing`,
        );
        return false;
      }

      // 4. Verificar que tenga horas trabajadas (después del checkout)
      // (FUTURO) Puede requerirse un mínimo de horas
      // if (attendance.hoursWorked < MIN_HOURS_FOR_PROFIT_SHARING) {
      //   return false;
      // }

      // 5. (FUTURO) Verificar tipo de worker - solo algunos tipos pueden contar
      // if (worker.workerType !== WorkerType.AGENT && worker.workerType !== WorkerType.MANAGER) {
      //   return false;
      // }

      // 6. (FUTURO) Verificar si es día festivo y reglas especiales aplican
      // if (attendance.isHoliday && !ALLOW_PROFIT_SHARING_ON_HOLIDAYS) {
      //   return false;
      // }

      // 7. (FUTURO) Verificar si el worker ya fue pagado para este período
      // if (attendance.isPaid) {
      //   return false;
      // }

      // 8. (FUTURO) Otras reglas de negocio personalizadas
      // const customRulesResult = await this.checkCustomProfitSharingRules(workerId, date, attendance);
      // if (!customRulesResult) {
      //   return false;
      // }

      console.log(
        `Worker ${workerId} is eligible for profit sharing on ${date.toISOString()}`,
      );
      return true;
    } catch (error) {
      console.error('Error determining profit sharing eligibility:', error);
      // En caso de error, por seguridad no contar para repartición
      return false;
    }
  }

  public isHoliday(
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): boolean {
    // Implementar lógica para verificar si es día festivo
    // Esto podría consultar una base de datos de días festivos
    // Por ahora, retornamos false
    return false;
  }

  // ========== MÉTODOS ADICIONALES PARA FUNCIONALIDAD EXTENDIDA ==========

  //   async generateDailyAttendances(
  //     date: Date,
  //     cu?: JWTPayload,
  //     scopes?: ScopedAccessEnum[],
  //     manager?: EntityManager,
  //   ): Promise<number> {
  //     // Obtener todos los workers activos
  //     // Para cada worker, crear registro de asistencia con status ABSENT
  //     // Retornar número de registros creados
  //     // (Implementación pendiente según estructura de tu aplicación)
  //     return 0;
  //   }

  //   async getAttendanceSummary(
  //     startDate: Date,
  //     endDate: Date,
  //     cu?: JWTPayload,
  //     scopes?: ScopedAccessEnum[],
  //     manager?: EntityManager,
  //   ): Promise<{
  //     totalWorkers: number;
  //     totalDays: number;
  //     averageAttendance: number;
  //     absencesByReason: Record<AttendanceStatus, number>;
  //   }> {
  //     // Generar reporte consolidado de asistencia
  //     // (Implementación pendiente según estructura de la aplicación)
  //     return {
  //       totalWorkers: 0,
  //       totalDays: 0,
  //       averageAttendance: 0,
  //       absencesByReason: {} as Record<AttendanceStatus, number>,
  //     };
  //   }
}
