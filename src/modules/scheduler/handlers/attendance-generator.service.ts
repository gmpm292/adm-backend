import { Injectable, Logger } from '@nestjs/common';
import { AttendanceService } from '../../payroll/attendance/services/attendance.service';
import { WorkerService } from '../../payroll/worker/services/worker.service';
import { Worker } from '../../payroll/worker/entities/worker.entity';
import { CreateAttendanceInput } from '../../payroll/attendance/dto/create-attendance.input';
import { AttendanceStatus } from '../../payroll/attendance/enums/attendance-status.enum';
import { SystemUtilsService } from '../../../core/services/system-utils.service';
import { Role } from '../../../core/enums/role.enum';

@Injectable()
export class AttendanceGeneratorService {
  private readonly logger = new Logger(AttendanceGeneratorService.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly workerService: WorkerService,
    private readonly utils: SystemUtilsService,
  ) {}

  /**
   * Abre el registro del día de cada trabajador (salvo los domingos). Nace
   * como ausente: pasa a presente al registrar la entrada. Así nadie cuenta
   * como presente, ni entra en el reparto, sin haber venido.
   * @returns Número de registros creados
   */
  async generateDailyAttendancesWithChecks(): Promise<number> {
    const systemUser = this.utils.getSystemUser();
    const cu = {
      sub: systemUser.id as number,
      role: systemUser.role as Array<Role>,
    };
    try {
      const today = new Date();
      if (today.getDay() === 0) {
        this.logger.log('Domingo: no se generan registros de asistencia');
        return 0;
      }

      this.logger.log(
        `Generando registros de asistencia del ${today.toISOString().split('T')[0]}`,
      );

      // Todos: sin `take` el listado devolvería solo los 10 primeros
      const total = (await this.workerService.find({ take: 0 })).totalCount;
      const workers = total
        ? ((await this.workerService.find({ skip: 0, take: total }))
            .data as Array<Worker>)
        : [];

      let createdCount = 0;
      let skippedCount = 0;

      for (const worker of workers) {
        const shouldWork = await this.attendanceService.shouldWorkToday(
          worker.id as number,
          today,
        );
        const existingAttendance =
          await this.attendanceService.findDailyAttendanceForWorker(
            worker.id as number,
            today,
            cu,
          );
        if (!shouldWork || existingAttendance) {
          skippedCount++;
          continue;
        }

        const attendanceData: CreateAttendanceInput = {
          workerId: worker.id as number,
          attendanceDate: today,
          status: AttendanceStatus.ABSENT,
          hoursWorked: 0,
          isHoliday: this.attendanceService.isHoliday(today),
          notes: 'Pendiente de registrar la entrada',
          businessId: worker.business?.id,
          officeId: worker.office?.id,
          departmentId: worker.department?.id,
          teamId: worker.team?.id,
        };

        await this.attendanceService.create(attendanceData, cu);
        createdCount++;
      }

      this.logger.log(
        `Asistencia: ${createdCount} registros creados, ${skippedCount} omitidos o ya existentes`,
      );
      return createdCount;
    } catch (error) {
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(
        `Error generando registros de asistencia: ${errorMessage}`,
      );
      throw error;
    }
  }
}
