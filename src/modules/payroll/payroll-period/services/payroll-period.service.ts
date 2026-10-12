import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePayrollPeriodInput } from '../dto/create-payroll-period.input';
import { UpdatePayrollPeriodInput } from '../dto/update-payroll-period.input';
import { BaseService } from '../../../../core/services/base.service';
import { PayrollPeriod } from '../entities/payroll-period.entity';
import {
  ListFilter,
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { WorkerPaymentService } from '../../worker-payment/services/worker-payment.service';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { SortDirection } from '../../../../core/graphql/remote-operations/enums/sort-direction.enum';

/**
 * Períodos de nómina de cada empresa: sin solapes, de 31 días como mucho.
 * Sobre ellos se calculan y se pagan los pagos a trabajadores.
 */
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

  /**
   * Crea un período abierto. Valida las fechas y que no se solape con otro de
   * la empresa indicada o, si no llega, de la del usuario.
   */
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
    // Solo se eliminan (borrado lógico) períodos sin pagos ni acumuladores.
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

  /**
   * Período listo para calcular pagos: visible para el usuario, abierto y ya
   * terminado. Lo usa el cálculo de nómina (`payment-processing`).
   */
  async validatePeriod(
    payrollPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ) {
    // 1. Existe y el usuario lo ve (findOne lanza NotFoundError si no)
    const payrollPeriod = await this.findOne(
      payrollPeriodId,
      cu,
      scopes,
      manager,
    );

    // 2. No está cerrado
    if (payrollPeriod.isClosed) {
      throw new BadRequestError('El período ya está cerrado');
    }

    // 3. Ya terminó
    const today = new Date();
    if (payrollPeriod.endDate > today) {
      throw new BadRequestError(
        'El período aún no ha terminado: se calcula al acabar',
      );
    }

    // 4. Fechas coherentes
    this.validatePeriodIntegrity(payrollPeriod);

    return payrollPeriod;
  }

  /** Dos períodos de la misma empresa (o ambos sin empresa) no se pisan */
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
    } else {
      query.andWhere('"period"."businessId" IS NULL');
    }
    if (exceptId) query.andWhere('period.id != :exceptId', { exceptId });
    const other = await query.getOne();
    if (other) {
      throw new ConflictError(
        `Las fechas se solapan con el período «${other.name}»`,
      );
    }
  }

  /** Inicio antes que fin y 31 días como mucho */
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

  /**
   * Período de la empresa (`businessId`, por defecto la del usuario) que
   * contiene la fecha. Si no hay, crea el siguiente al último de esa empresa
   * (mensual, quincenal o semanal, como aquel) o, si no existe ninguno, la
   * semana de lunes a domingo de la fecha.
   */
  async getCurrentOrCreatePeriod(
    date: Date,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
    businessId: number | undefined = cu?.businessId,
  ): Promise<PayrollPeriod> {
    if (!cu || !businessId) {
      throw new BadRequestError('El usuario no pertenece a ninguna empresa');
    }

    // Buscar período existente que contenga la fecha
    const existingPeriod = await this.findPeriodForDate(
      date,
      businessId,
      cu,
      scopes,
      manager,
    );

    if (existingPeriod) {
      return existingPeriod;
    }

    // Buscar el último período del negocio
    const lastPeriod = await this.findLastPeriod(
      businessId,
      cu,
      scopes,
      manager,
    );

    // Crear nuevo período
    return lastPeriod
      ? this.createPeriodAfter(lastPeriod, businessId, cu, scopes, manager)
      : this.createFirstPeriod(date, businessId, cu, scopes, manager);
  }

  /** Filtro por la empresa del período */
  private ofBusiness(businessId: number): ListFilter {
    return {
      property: 'businessId',
      operator: ConditionalOperator.EQUAL,
      value: String(businessId),
    };
  }

  /** Período visible de la empresa que contiene la fecha, o null. */
  private async findPeriodForDate(
    date: Date,
    businessId: number,
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod | null> {
    const dateStr = date.toISOString().split('T')[0];

    const result = await super.baseFind({
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
          this.ofBusiness(businessId),
        ],
        take: 1,
      },
      relationsToLoad: ['business'],
      cu,
      scopes,
      manager,
    });

    return (result.data?.[0] as PayrollPeriod) || null;
  }

  private async findLastPeriod(
    businessId: number,
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod | null> {
    const result = await super.baseFind({
      options: {
        filters: [this.ofBusiness(businessId)],
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
    businessId: number,
    cu: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PayrollPeriod> {
    // Obtener el día de la semana (0=domingo, 1=lunes, ..., 6=sábado)
    const dayOfWeek = referenceDate.getDay();

    // Calcular días hasta el lunes anterior
    // Si es domingo (0): -6 (lunes anterior)
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
      businessId,
    };

    return this.create(createInput, cu, scopes, manager);
  }

  /**
   * Período que empieza el día siguiente al anterior. Su duración la deduce
   * la del anterior: mensual (28-31 días), quincenal (14-16, cortando a mitad
   * o a final de mes) o, en cualquier otro caso, semanal.
   */
  private async createPeriodAfter(
    previousPeriod: PayrollPeriod,
    businessId: number,
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
      businessId,
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
