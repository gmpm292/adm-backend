import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePayrollPeriodInput } from '../dto/create-payroll-period.input';
import { UpdatePayrollPeriodInput } from '../dto/update-payroll-period.input';
import { BaseService } from '../../../../core/services/base.service';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { WorkerPaymentService } from '../../worker-payment/services/worker-payment.service';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';

@Injectable()
export class PayrollPeriodService extends BaseService<PayrollPeriod> {
  constructor(
    @InjectRepository(PayrollPeriod)
    private payrollPeriodRepository: Repository<PayrollPeriod>,
    @Inject(forwardRef(() => WorkerPaymentService))
    private workerPaymentService: WorkerPaymentService,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(payrollPeriodRepository);
  }

  async create(
    createPayrollPeriodInput: CreatePayrollPeriodInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const payrollPeriod = {
      ...createPayrollPeriodInput,
      name: createPayrollPeriodInput.name.trim(),
      startDate: new Date(createPayrollPeriodInput.startDate),
      endDate: new Date(createPayrollPeriodInput.endDate),
      isClosed: false,
    } as PayrollPeriod;

    this.validatePeriodIntegrity(payrollPeriod);
    await this.assertNoOverlap(
      payrollPeriod,
      createPayrollPeriodInput.businessId ?? cu?.businessId,
      undefined,
      manager,
    );

    return super.baseCreate({
      data: payrollPeriod,
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
        'payments',
        'payments.worker',
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
  ): Promise<PayrollPeriod> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        payments: { worker: { user: true } },
        business: true,
        createdBy: true,
        updatedBy: true,
        office: true,
        department: true,
        team: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  /** Cierra un período ya terminado y con todos sus pagos hechos */
  async closePeriod(
    id: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const period = await super.baseFindOne({ id, cu, scopes, manager });
    if (period.isClosed) {
      throw new BadRequestError('El período ya está cerrado');
    }
    if (new Date(period.endDate) > new Date()) {
      throw new BadRequestError('El período aún no ha terminado');
    }

    const pendingPayments = (
      await this.workerPaymentService.find(
        {
          filters: [
            {
              property: 'payrollPeriod.id',
              operator: ConditionalOperator.EQUAL,
              value: id.toString(),
            },
            {
              property: 'paidDate',
              operator: ConditionalOperator.IS_NULL,
              value: '',
            },
          ],
          take: 0,
        },
        cu,
        scopes,
        manager,
      )
    ).totalCount;
    if (pendingPayments > 0) {
      throw new BadRequestError(
        `Quedan ${pendingPayments} pagos sin hacer en este período: márcalos como pagados antes de cerrarlo`,
      );
    }

    return super.baseUpdate({
      id,
      data: { isClosed: true },
      cu,
      scopes,
      manager,
    });
  }

  /** Nombre, descripción y fechas; cerrar se hace con `closePeriod` */
  async update(
    id: number,
    updatePayrollPeriodInput: UpdatePayrollPeriodInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const period = await super.baseFindOne({
      id,
      relationsToLoad: { payments: true, business: true },
      cu,
      scopes,
      manager,
    });
    if (period.isClosed) {
      throw new BadRequestError('Un período cerrado no se modifica');
    }

    const { name, description, startDate, endDate } = updatePayrollPeriodInput;
    const data: Partial<PayrollPeriod> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) {
      data.description = description?.trim() || (null as unknown as string);
    }
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);

    if (data.startDate || data.endDate) {
      if (period.payments?.length) {
        throw new BadRequestError(
          'Este período ya tiene pagos: sus fechas no se cambian',
        );
      }
      const merged = { ...period, ...data } as PayrollPeriod;
      this.validatePeriodIntegrity(merged);
      await this.assertNoOverlap(merged, period.business?.id, id, manager);
    }

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
  ): Promise<PayrollPeriod[]> {
    const periods = await super.baseFindByIds({
      ids,
      relationsToLoad: { payments: true, paymentAccumulators: true },
      cu,
      scopes,
      manager,
    });

    if (
      periods.some((p) => p.payments?.length || p.paymentAccumulators?.length)
    ) {
      throw new BadRequestError(
        'Un período con pagos calculados no se elimina',
      );
    }

    return super.baseDeleteMany({
      ids: periods.map((p) => p.id) as Array<number>,
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

  async validatePeriod(
    payrollPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ) {
    // 1. Verificar que el período existe
    const payrollPeriod = await this.findOne(
      payrollPeriodId,
      cu,
      scopes,
      manager,
    );

    if (!payrollPeriod) {
      throw new NotFoundError('Payroll period not found');
    }

    // 2. Verificar que el período no esté cerrado
    if (payrollPeriod.isClosed) {
      throw new BadRequestError('El período ya está cerrado');
    }

    // 3. Validar fechas del período
    const today = new Date();
    if (payrollPeriod.endDate > today) {
      throw new BadRequestError(
        'El período aún no ha terminado: se calcula al acabar',
      );
    }

    // 6. Verificar integridad de datos del período
    this.validatePeriodIntegrity(payrollPeriod);

    return payrollPeriod;
  }

  /** Dos períodos de la misma empresa no se pisan */
  private async assertNoOverlap(
    period: PayrollPeriod,
    businessId: number | undefined,
    exceptId: number | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    const repository =
      manager?.getRepository(PayrollPeriod) ?? this.payrollPeriodRepository;
    const query = repository
      .createQueryBuilder('period')
      .where('period.startDate <= :end', { end: period.endDate })
      .andWhere('period.endDate >= :start', { start: period.startDate });
    if (businessId) {
      query.andWhere('"period"."businessId" = :businessId', { businessId });
    }
    if (exceptId) query.andWhere('period.id != :exceptId', { exceptId });
    const other = await query.getOne();
    if (other) {
      throw new ConflictError(
        `Las fechas se solapan con el período «${other.name}»`,
      );
    }
  }

  private validatePeriodIntegrity(payrollPeriod: PayrollPeriod) {
    // Verificar que startDate sea anterior a endDate
    if (payrollPeriod.startDate >= payrollPeriod.endDate) {
      throw new BadRequestError(
        'La fecha de inicio debe ser anterior a la de fin',
      );
    }

    // Verificar que el período no sea demasiado largo (ej: máximo 31 días)
    const daysDiff = Math.ceil(
      (payrollPeriod.endDate.getTime() - payrollPeriod.startDate.getTime()) /
        (1000 * 3600 * 24),
    );

    if (daysDiff > 31) {
      throw new BadRequestError('Un período no puede durar más de 31 días');
    }
  }

  async getCurrentOrCreatePeriod(
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    if (!cu?.businessId) {
      throw new BadRequestError('El usuario no pertenece a ninguna empresa');
    }

    // Buscar período existente que contenga la fecha
    const existingPeriod = await this.findPeriodForDate(
      date,
      cu,
      scopes,
      manager,
    );

    if (existingPeriod) {
      return existingPeriod;
    }

    // Buscar el último período del negocio
    const lastPeriod = await this.findLastPeriod(cu, scopes, manager);

    // Crear nuevo período
    return lastPeriod
      ? this.createPeriodAfter(lastPeriod, cu, scopes, manager)
      : this.createFirstPeriod(date, cu, scopes, manager);
  }

  private async findPeriodForDate(
    date: Date,
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod | null> {
    const dateStr = date.toISOString().split('T')[0];

    let result: ListSummary | null = null;
    try {
      result = await super.baseFind({
        options: {
          filters: [
            {
              property: 'startDate',
              operator: ConditionalOperator.LESS_EQUAL_THAN,
              value: dateStr,
            },
            {
              property: 'endDate',
              operator: ConditionalOperator.GREATER_EQUAL_THAN,
              value: dateStr,
            },
          ],
          take: 1,
        },
        cu,
        scopes,
        manager,
      });
    } catch (error) {
      console.error(
        `Error al buscar periodo de nómina para fecha ${dateStr}:`,
        error,
      );
    }

    return (result?.data?.[0] as PayrollPeriod) || null;
  }

  private async findLastPeriod(
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod | null> {
    const result = await super.baseFind({
      options: {
        sorts: [{ property: 'endDate', direction: SortDirection.DESC }],
        take: 1,
      },
      cu,
      scopes,
      manager,
    });

    return (result.data?.[0] as PayrollPeriod) || null;
  }

  private createFirstPeriod(
    referenceDate: Date,
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    // Obtener el día de la semana (0=domingo, 1=lunes, ..., 6=sábado)
    const dayOfWeek = referenceDate.getDay();

    // Calcular días hasta el lunes anterior
    // Si es domingo (0): -1 (lunes anterior)
    // Si es lunes (1): 0 (hoy es lunes)
    // Si es martes (2): -1, etc.
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    // Calcular días hasta el domingo siguiente
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    // Calcular fechas de inicio y fin (lunes a domingo)
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() + daysToMonday);
    startDate.setHours(0, 0, 0, 0); // Inicio del día

    const endDate = new Date(referenceDate);
    endDate.setDate(endDate.getDate() + daysToSunday);
    endDate.setHours(23, 59, 59, 999); // Fin del día

    const name = this.generatePeriodName(startDate, endDate);

    const createInput: CreatePayrollPeriodInput = {
      startDate,
      endDate,
      name,
      description: 'Primer período, creado al calcular pagos',
      businessId: cu.businessId!,
    };

    return this.create(createInput, cu, scopes, manager);
  }

  private async createPeriodAfter(
    previousPeriod: PayrollPeriod,
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    const endDate = new Date(previousPeriod.endDate);
    const startDate = new Date(previousPeriod.startDate);

    if (isNaN(endDate.getTime()) || isNaN(startDate.getTime())) {
      throw new BadRequestError('Fechas inválidas en el período anterior');
    }
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24),
    );

    const newStartDate = new Date(endDate);
    newStartDate.setDate(newStartDate.getDate() + 1);
    newStartDate.setHours(0, 0, 0, 0); // Inicio del día

    const newEndDate = new Date(newStartDate);

    if (daysDiff >= 28 && daysDiff <= 31) {
      // Mensual - siguiente mes
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      newEndDate.setDate(newEndDate.getDate() - 1);
    } else if (daysDiff >= 14 && daysDiff <= 16) {
      // Quincenal - calcular según mitad del mes
      const year = newStartDate.getFullYear();
      const month = newStartDate.getMonth();
      const dayOfMonth = newStartDate.getDate();

      // Obtener último día del mes actual
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

      // Calcular mitad del mes (redondeo hacia arriba)
      const middleDay = Math.ceil(lastDayOfMonth / 2);

      // Determinar si estamos en primera o segunda quincena
      const isFirstQuincena = dayOfMonth <= middleDay;

      if (isFirstQuincena) {
        // Primera quincena -> termina en la mitad del mes
        newEndDate.setDate(middleDay);
      } else {
        // Segunda quincena -> termina último día del mes
        newEndDate.setDate(lastDayOfMonth);

        // Verificar que no hayamos pasado al siguiente mes
        // (esto pasa si el mes tiene menos de 31 días y estamos después del día 15)
        if (newEndDate.getMonth() !== month) {
          newEndDate.setMonth(month);
          newEndDate.setDate(lastDayOfMonth);
        }
      }
    } else {
      // Semanal - 7 días
      newEndDate.setDate(newEndDate.getDate() + 6);
    }

    newEndDate.setHours(23, 59, 59, 999); // Fin del día

    const name = this.generatePeriodName(newStartDate, newEndDate);

    const createInput: CreatePayrollPeriodInput = {
      startDate: newStartDate,
      endDate: newEndDate,
      name,
      description: 'Creado al calcular pagos',
      businessId: cu.businessId!,
    };

    return this.create(createInput, cu, scopes, manager);
  }

  private generatePeriodName(startDate: Date, endDate: Date): string {
    const formatDate = (date: Date): string => {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    };

    return `${formatDate(startDate)} / ${formatDate(endDate)}`;
  }
}
