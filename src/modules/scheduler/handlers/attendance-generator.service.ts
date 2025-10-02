import { Injectable, Logger } from '@nestjs/common';
import { AttendanceService } from '../../payroll/attendance/services/attendance.service';
import { WorkerService } from '../../payroll/worker/services/worker.service';
import { Worker } from '../../payroll/worker/entities/worker.entity';
import { CreateAttendanceInput } from '../../payroll/attendance/dto/create-attendance.input';
import { AttendanceStatus } from '../../payroll/attendance/enums/attendance-status.enum';

@Injectable()
export class AttendanceGeneratorService {
  private readonly logger = new Logger(AttendanceGeneratorService.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly workerService: WorkerService,
  ) {}

  /**
   * Genera registros de asistencia diarios para todos los workers activos
   * @returns Número de registros creados
   */
  async generateDailyAttendances(): Promise<number> {
    try {
      const today = new Date();
      this.logger.log(
        `Iniciando generación de registros de asistencia para: ${today.toISOString().split('T')[0]}`,
      );

      // Obtener todos los workers activos
      const activeWorkers = await this.workerService.find();

      let createdCount = 0;
      let skippedCount = 0;

      for (const worker of activeWorkers.data as Array<Worker>) {
        // Verificar si ya existe un registro para hoy
        const existingAttendance =
          await this.attendanceService.findDailyAttendanceForWorker(
            worker.id as number,
            today,
          );

        if (!existingAttendance) {
          // Crear registro de asistencia con estado ABSENT por defecto
          const attendanceData: CreateAttendanceInput = {
            workerId: worker.id as number,
            attendanceDate: today,
            status: AttendanceStatus.ABSENT,
            hoursWorked: 0,
            isHoliday: false,
            //isPaid: false,
            notes: 'Registro automático generado por sistema',
          };

          await this.attendanceService.create(attendanceData);
          createdCount++;
        } else {
          skippedCount++;
        }
      }

      this.logger.log(
        `Generación completada: ${createdCount} registros creados, ${skippedCount} ya existían`,
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

  /**
   * Versión mejorada que considera días no laborables
   */
  async generateDailyAttendancesWithChecks(): Promise<number> {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Domingo, 6 = Sábado

      // No generar registros los fines de semana (opcional)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        this.logger.log(`Fin de semana - omitiendo generación de registros`);
        return 0;
      }

      this.logger.log(
        `Iniciando generación de registros de asistencia para: ${today.toISOString().split('T')[0]}`,
      );

      const activeWorkers = await this.workerService.find();

      let createdCount = 0;
      let skippedCount = 0;

      for (const worker of activeWorkers.data as Array<Worker>) {
        // Verificar si el worker debería trabajar hoy
        const shouldWork = await this.attendanceService.shouldWorkToday(
          worker.id as number,
          today,
        );

        if (!shouldWork) {
          skippedCount++;
          continue;
        }

        const existingAttendance =
          await this.attendanceService.findDailyAttendanceForWorker(
            worker.id as number,
            today,
          );

        if (!existingAttendance) {
          const attendanceData: CreateAttendanceInput = {
            workerId: worker.id as number,
            attendanceDate: today,
            status: AttendanceStatus.ABSENT,
            hoursWorked: 0,
            isHoliday: this.attendanceService.isHoliday(today),
            //isPaid: false,
            notes: 'Registro automático generado por sistema',
          };

          await this.attendanceService.create(attendanceData);
          createdCount++;
        } else {
          skippedCount++;
        }
      }

      this.logger.log(
        `Generación completada: ${createdCount} registros creados, ${skippedCount} omitidos/existentes`,
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
