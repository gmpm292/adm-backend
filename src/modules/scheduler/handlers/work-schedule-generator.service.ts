import { Injectable, Logger } from '@nestjs/common';
import { WorkScheduleService } from '../../payroll/work-schedule/services/work-schedule.service';
import { CreateWorkScheduleInput } from '../../payroll/work-schedule/dto/create-work-schedule.input';
import { ConditionalOperator } from '../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { WorkSchedule } from '../../payroll/work-schedule/entities/work-schedule.entity';

@Injectable()
export class WorkScheduleGeneratorService {
  private readonly logger = new Logger(WorkScheduleGeneratorService.name);

  constructor(private readonly workScheduleService: WorkScheduleService) {}

  /**
   * Genera los WorkSchedules para un año completo
   * @param year Año a planificar
   * @param officeId ID de la oficina (opcional)
   * @returns Número de semanas planificadas
   */
  async generateYearlyWorkSchedules(
    year: number,
    officeId?: number,
  ): Promise<number> {
    try {
      this.logger.log(`Iniciando generación de horarios para el año ${year}`);

      // Verificar si ya existe planificación para este año
      const existingSchedules = await this.getExistingSchedulesForYear(
        year,
        officeId,
      );

      if (existingSchedules.length > 0) {
        this.logger.log(
          `Ya existen ${existingSchedules.length} horarios para el año ${year}`,
        );
        return existingSchedules.length;
      }

      // Generar todas las semanas del año
      const weeks = this.generateWeeksForYear(year);
      let createdCount = 0;

      for (const week of weeks) {
        const workScheduleInput: CreateWorkScheduleInput = {
          name: `Semana${week.weekNumber}-${year}`, // incluir la fecha completa.
          startDate: week.startDate,
          endDate: week.endDate,
          workingDays: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: false, // Por defecto, domingo no laborable
          },
          notes: `Horario generado automáticamente para la semana ${week.weekNumber} del ${year}`,
          officeId: officeId,
        };

        await this.workScheduleService.create(workScheduleInput);
        createdCount++;
      }

      this.logger.log(
        `Generación completada: ${createdCount} semanas planificadas para el año ${year}`,
      );
      return createdCount;
    } catch (error) {
      const errorMsg =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(
        `Error generando horarios para el año ${year}: ${errorMsg}`,
      );
      throw error;
    }
  }

  /**
   * Verifica y completa la planificación del próximo año si es necesario
   * Se ejecuta mensualmente para asegurar que el próximo año esté planificado
   */
  async verifyAndCompleteNextYearPlanning(): Promise<number> {
    try {
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const currentMonth = new Date().getMonth() + 1; // 1-12

      // Solo planificar el próximo año a partir de octubre
      if (currentMonth < 10) {
        this.logger.log(
          `Planificación del ${nextYear} no requerida aún (mes actual: ${currentMonth})`,
        );
        return 0;
      }

      this.logger.log(
        `Verificando planificación para el próximo año: ${nextYear}`,
      );

      // Verificar si ya existe planificación para el próximo año
      const existingSchedules =
        await this.getExistingSchedulesForYear(nextYear);

      if (existingSchedules.length >= 52) {
        // Un año tiene aproximadamente 52 semanas
        this.logger.log(
          `Planificación del ${nextYear} ya está completa: ${existingSchedules.length} semanas`,
        );
        return existingSchedules.length;
      }

      // Si existe alguna planificación pero no está completa, eliminarla y regenerar
      if (existingSchedules.length > 0) {
        this.logger.log(
          `Eliminando planificación incompleta del ${nextYear}: ${existingSchedules.length} semanas`,
        );
        const ids = existingSchedules.map((schedule) => schedule.id as number);
        await this.workScheduleService.remove(ids);
      }

      // Generar planificación completa para el próximo año
      return await this.generateYearlyWorkSchedules(nextYear);
    } catch (error) {
      const errorMsg =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(
        `Error verificando planificación del próximo año: ${errorMsg}`,
      );
      throw error;
    }
  }

  /**
   * Obtiene los horarios existentes para un año específico
   */
  private async getExistingSchedulesForYear(
    year: number,
    officeId?: number,
  ): Promise<Array<WorkSchedule>> {
    const startDate = new Date(year, 0, 1); // 1 de enero del año
    const endDate = new Date(year, 11, 31); // 31 de diciembre del año

    // Esta implementación depende de cómo esté implementado tu baseFind
    // Ajusta según tu implementación específica
    const result = await this.workScheduleService.find({
      filters: [
        {
          property: 'startDate',
          operator: ConditionalOperator.GREATER_EQUAL_THAN,
          value: startDate.toISOString().split('T')[0],
        },
        {
          property: 'endDate',
          operator: ConditionalOperator.LESS_EQUAL_THAN,
          value: endDate.toISOString().split('T')[0],
        },
        ...(officeId
          ? [
              {
                property: 'office.id',
                operator: ConditionalOperator.EQUAL,
                value: officeId.toString(),
              },
            ]
          : []),
      ],
      take: 100, // Suficiente para todas las semanas del año
    });

    return (result.data as Array<WorkSchedule>) || [];
  }

  /**
   * Genera todas las semanas de un año específico
   */
  private generateWeeksForYear(year: number): Array<{
    weekNumber: number;
    startDate: Date;
    endDate: Date;
  }> {
    const weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }> =
      [];
    const currentDate = new Date(year, 0, 1); // 1 de enero

    // Ajustar al primer lunes del año
    while (currentDate.getDay() !== 1) {
      // 1 = lunes
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let weekNumber = 1;

    while (currentDate.getFullYear() <= year) {
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 6); // Domingo

      // Si el domingo ya es del próximo año, ajustar
      if (endDate.getFullYear() > year) {
        endDate.setFullYear(year);
        endDate.setMonth(11);
        endDate.setDate(31); // 31 de diciembre
      }

      weeks.push({
        weekNumber: weekNumber++,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      // Mover a la siguiente semana
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return weeks;
  }

  /**
   * Método para obtener el número de semana de una fecha
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}
