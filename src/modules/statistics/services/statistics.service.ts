/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { JWTPayload } from '../../auth/dto/jwt-payload.dto';
import { StatisticsFilterInput } from '../dto/statistics-filter.input';
import { BadRequestError } from '../../../core/errors/appErrors/BadRequestError.error';
import { Role } from '../../../core/enums/role.enum';
import { SaleStatus } from '../../sales/sale/enums/sale-status.enum';

/** Sales that count as income: confirmed, even if part was later refunded */
const REVENUE_STATUSES = [SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_REFUNDED];

/** Longest period reported day by day; longer ones are grouped by month */
const MAX_DAILY_POINTS = 92;
const MAX_PERIOD_DAYS = 366 * 5;
const RANKING_SIZE = 10;
const LOW_STOCK_SIZE = 8;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type Row = Record<string, any>;

/**
 * A query being built: the scope conditions of each table share one
 * parameter list
 */
class QueryParams {
  public readonly values: unknown[] = [];

  /** Registers a value and returns its placeholder */
  public add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

interface Scope {
  businessId?: number;
  officeId?: number;
  departmentId?: number;
  teamId?: number;
}

interface Period {
  from: string;
  /** Day after the last one, so the range is [from, toExclusive) */
  toExclusive: string;
  to: string;
  days: number;
  /** Minutes to add to stored timestamps to read them in the user's clock */
  shiftMinutes: number;
  granularity: 'day' | 'month';
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectEntityManager()
    private readonly manager: EntityManager,
  ) {}

  public async dashboard(cu: JWTPayload, input: StatisticsFilterInput) {
    const scope = this.resolveScope(cu, input);
    const period = this.resolvePeriod(input);
    const previous = this.previousPeriod(period);
    const currencies = await this.findCurrencies(scope);
    const currency = this.pickCurrency(input.currency, currencies);

    const [
      totals,
      previousTotals,
      byStatus,
      revenueSeries,
      lowStock,
      lowStockCount,
      draftSalesCount,
      pendingWorkerPayments,
      payrollPaid,
      attendance,
      activeWorkersCount,
      productsCount,
      customersCount,
    ] = await Promise.all([
      this.salesTotals(scope, period, currency),
      this.salesTotals(scope, previous, currency),
      this.salesByStatus(scope, period),
      this.revenueSeries(scope, period, currency),
      this.lowStock(scope),
      this.lowStockCount(scope),
      this.draftSalesCount(scope),
      this.pendingWorkerPayments(scope),
      this.payrollPaid(scope, period),
      this.attendance(scope, period),
      this.countRows('py_workers', scope),
      this.countRows('in_products', scope),
      this.countRows('sl_customers', scope),
    ]);

    const countOf = (...statuses: SaleStatus[]) =>
      byStatus
        .filter((row) => statuses.includes(row.key as SaleStatus))
        .reduce((sum, row) => sum + row.count, 0);

    return {
      period: this.describePeriod(period, currency, currencies),
      ...totals,
      previousRevenue: previousTotals.revenue,
      previousSalesCount: previousTotals.salesCount,
      refundedSalesCount: countOf(
        SaleStatus.PARTIALLY_REFUNDED,
        SaleStatus.FULLY_REFUNDED,
      ),
      cancelledSalesCount: countOf(SaleStatus.CANCELLED),
      revenueSeries,
      lowStockCount,
      lowStock,
      draftSalesCount,
      pendingWorkerPayments,
      payrollPaid,
      attendance,
      activeWorkersCount,
      productsCount,
      customersCount,
    };
  }

  public async sales(cu: JWTPayload, input: StatisticsFilterInput) {
    const scope = this.resolveScope(cu, input);
    const period = this.resolvePeriod(input);
    const currencies = await this.findCurrencies(scope);
    const currency = this.pickCurrency(input.currency, currencies);

    const [
      totals,
      deliveriesCount,
      topProducts,
      byCategory,
      bySeller,
      topCustomers,
      byPaymentMethod,
      byStatus,
      customerMix,
    ] = await Promise.all([
      this.salesTotals(scope, period, currency),
      this.deliveriesCount(scope, period, currency),
      this.productRanking(scope, period, currency, 'product'),
      this.productRanking(scope, period, currency, 'category'),
      this.sellerRanking(scope, period, currency),
      this.customerRanking(scope, period, currency),
      this.paymentMethods(scope, period, currency),
      this.salesByStatus(scope, period),
      this.customerMix(scope, period, currency),
    ]);

    return {
      period: this.describePeriod(period, currency, currencies),
      ...totals,
      deliveriesCount,
      topProducts,
      byCategory,
      bySeller,
      topCustomers,
      byPaymentMethod,
      byStatus,
      ...customerMix,
    };
  }

  // ---------------------------------------------------------------------------
  // Scope and period
  // ---------------------------------------------------------------------------

  /**
   * What the user may see: SUPER everything (optionally narrowed by the
   * filter), everybody else only their own business, office, department or
   * team, according to their role.
   */
  private resolveScope(cu: JWTPayload, input: StatisticsFilterInput): Scope {
    const roles = cu.role ?? [];
    const has = (...expected: Role[]) =>
      roles.some((role) => expected.includes(role));

    if (has(Role.SUPER)) {
      return { businessId: input.businessId, officeId: input.officeId };
    }

    const scope: Scope = { businessId: cu.businessId };
    if (has(Role.PRINCIPAL)) {
      scope.officeId = input.officeId;
      return scope;
    }

    scope.officeId = cu.officeId;
    if (has(Role.ADMIN)) return scope;

    scope.departmentId = cu.departmentId;
    if (has(Role.MANAGER)) return scope;

    scope.teamId = cu.teamId;
    return scope;
  }

  private resolvePeriod(input: StatisticsFilterInput): Period {
    const from = this.parseDay(input.dateFrom);
    const to = this.parseDay(input.dateTo);
    const days = Math.round((to - from) / DAY_IN_MS) + 1;

    if (days < 1) {
      throw new BadRequestError('dateTo must not be before dateFrom');
    }
    if (days > MAX_PERIOD_DAYS) {
      throw new BadRequestError('The period is too long');
    }

    // Timestamps are stored in the server's clock. Shifting them by the
    // difference with the user's clock makes a day start when the user's does.
    const serverOffset = -new Date().getTimezoneOffset();
    const shiftMinutes =
      (input.utcOffsetMinutes ?? serverOffset) - serverOffset;

    return {
      from: input.dateFrom,
      to: input.dateTo,
      toExclusive: this.formatDay(to + DAY_IN_MS),
      days,
      shiftMinutes,
      granularity: days > MAX_DAILY_POINTS ? 'month' : 'day',
    };
  }

  /** The period of the same length that ends right before the given one */
  private previousPeriod(period: Period): Period {
    const from = this.parseDay(period.from);
    return {
      ...period,
      from: this.formatDay(from - period.days * DAY_IN_MS),
      to: this.formatDay(from - DAY_IN_MS),
      toExclusive: period.from,
    };
  }

  private parseDay(day: string): number {
    const time = Date.parse(`${day}T00:00:00Z`);
    if (Number.isNaN(time)) {
      throw new BadRequestError(`Invalid date: ${day}`);
    }
    return time;
  }

  private formatDay(time: number): string {
    return new Date(time).toISOString().slice(0, 10);
  }

  private describePeriod(
    period: Period,
    currency: string | null,
    currencies: string[],
  ) {
    return {
      dateFrom: period.from,
      dateTo: period.to,
      currency,
      currencies,
      granularity: period.granularity,
    };
  }

  private pickCurrency(
    requested: string | undefined,
    currencies: string[],
  ): string | null {
    if (requested) return requested.toUpperCase();
    return currencies[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // SQL fragments
  // ---------------------------------------------------------------------------

  /** Conditions that keep a table inside the user's scope and not deleted */
  private scopeSql(alias: string, scope: Scope, params: QueryParams): string {
    const conditions = [`${alias}."deletedAt" IS NULL`];
    for (const key of [
      'businessId',
      'officeId',
      'departmentId',
      'teamId',
    ] as const) {
      const value = scope[key];
      if (value !== undefined && value !== null) {
        conditions.push(`${alias}."${key}" = ${params.add(value)}`);
      }
    }
    return conditions.join(' AND ');
  }

  /** Moment a sale counts for, read in the user's clock */
  private saleMomentSql(period: Period, params: QueryParams): string {
    return `(COALESCE(s."effectiveDate", s."createdAt") + make_interval(mins => ${params.add(period.shiftMinutes)}::int))`;
  }

  /** Sales of the period inside the scope, whatever their status */
  private salesInPeriodSql(
    scope: Scope,
    period: Period,
    params: QueryParams,
  ): string {
    const moment = this.saleMomentSql(period, params);
    return [
      this.scopeSql('s', scope, params),
      `${moment} >= ${params.add(period.from)}::date`,
      `${moment} < ${params.add(period.toExclusive)}::date`,
    ].join(' AND ');
  }

  /** Sales of the period that count as income in the given currency */
  private revenueSalesSql(
    scope: Scope,
    period: Period,
    currency: string | null,
    params: QueryParams,
  ): string {
    return [
      this.salesInPeriodSql(scope, period, params),
      `s."saleStatus" = ANY(${params.add(REVENUE_STATUSES)}::"sl_sales_salestatus_enum"[])`,
      `s."totalAmountCurrency" = ${params.add(currency)}`,
    ].join(' AND ');
  }

  private query(sql: string, params: QueryParams): Promise<Row[]> {
    return this.manager.query(sql, params.values);
  }

  // ---------------------------------------------------------------------------
  // Sales
  // ---------------------------------------------------------------------------

  private async findCurrencies(scope: Scope): Promise<string[]> {
    const params = new QueryParams();
    const rows = await this.query(
      `SELECT s."totalAmountCurrency" AS currency
         FROM sl_sales s
        WHERE ${this.scopeSql('s', scope, params)}
          AND s."saleStatus" = ANY(${params.add(REVENUE_STATUSES)}::"sl_sales_salestatus_enum"[])
          AND s."totalAmountCurrency" IS NOT NULL
        GROUP BY 1
        ORDER BY count(*) DESC, 1`,
      params,
    );
    return rows.map((row) => row.currency);
  }

  private async salesTotals(
    scope: Scope,
    period: Period,
    currency: string | null,
  ) {
    const params = new QueryParams();
    const [row] = await this.query(
      `SELECT COALESCE(sum(s."totalAmount" - COALESCE(s."refundedAmount", 0)), 0) AS revenue, count(*) AS sales
         FROM sl_sales s
        WHERE ${this.revenueSalesSql(scope, period, currency, params)}`,
      params,
    );
    const revenue = Number(row.revenue);
    const salesCount = Number(row.sales);
    return {
      revenue,
      salesCount,
      averageTicket: salesCount > 0 ? revenue / salesCount : 0,
    };
  }

  private async salesByStatus(scope: Scope, period: Period) {
    const params = new QueryParams();
    const rows = await this.query(
      `SELECT s."saleStatus" AS key, count(*) AS count,
              COALESCE(sum(s."totalAmount"), 0) AS amount
         FROM sl_sales s
        WHERE ${this.salesInPeriodSql(scope, period, params)}
        GROUP BY 1
        ORDER BY 2 DESC`,
      params,
    );
    return rows.map((row) => ({
      key: row.key,
      count: Number(row.count),
      amount: Number(row.amount),
    }));
  }

  /** One point per day or month of the period, including the empty ones */
  private async revenueSeries(
    scope: Scope,
    period: Period,
    currency: string | null,
  ) {
    const params = new QueryParams();
    const unit = params.add(period.granularity);
    const moment = this.saleMomentSql(period, params);
    const format = period.granularity === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

    const rows = await this.query(
      `SELECT to_char(bucket.start, '${format}') AS period,
              COALESCE(sum(sale.amount), 0) AS revenue,
              count(sale.id) AS sales
         FROM generate_series(
                date_trunc(${unit}, ${params.add(period.from)}::date::timestamp),
                date_trunc(${unit}, ${params.add(period.to)}::date::timestamp),
                ('1 ' || ${unit})::interval
              ) AS bucket(start)
         LEFT JOIN (
               SELECT s.id, s."totalAmount" - COALESCE(s."refundedAmount", 0) AS amount,
                      date_trunc(${unit}, ${moment}) AS start
                 FROM sl_sales s
                WHERE ${this.revenueSalesSql(scope, period, currency, params)}
              ) sale ON sale.start = bucket.start
        GROUP BY bucket.start
        ORDER BY bucket.start`,
      params,
    );
    return rows.map((row) => ({
      period: row.period,
      revenue: Number(row.revenue),
      salesCount: Number(row.sales),
    }));
  }

  private async deliveriesCount(
    scope: Scope,
    period: Period,
    currency: string | null,
  ): Promise<number> {
    const params = new QueryParams();
    const [row] = await this.query(
      `SELECT count(*) AS count
         FROM sl_sales s
        WHERE ${this.revenueSalesSql(scope, period, currency, params)}
          AND s."hasDelivery" = true`,
      params,
    );
    return Number(row.count);
  }

  /**
   * Units sold by product or by category. The amount is the base price of
   * each line, counted only when it is expressed in the reported currency.
   */
  private async productRanking(
    scope: Scope,
    period: Period,
    currency: string | null,
    groupBy: 'product' | 'category',
  ) {
    const params = new QueryParams();
    const amountCurrency = params.add(currency);
    const group =
      groupBy === 'product'
        ? { id: 'p.id', name: 'p.name', detail: 'c.name' }
        : {
            id: 'c.id',
            name: `COALESCE(c.name, 'Sin categoría')`,
            detail: 'NULL',
          };

    const rows = await this.query(
      `SELECT ${group.id} AS id, ${group.name} AS name, ${group.detail} AS detail,
              sum(d.quantity) AS quantity,
              count(DISTINCT s.id) AS count,
              COALESCE(sum(
                CASE WHEN d."productPaymentOptions"->>'baseCurrency' = ${amountCurrency}
                     THEN (d."productPaymentOptions"->>'basePrice')::numeric * d.quantity
                END), 0) AS amount
         FROM sl_sale_details d
         JOIN sl_sales s ON s.id = d."saleId"
         JOIN in_products p ON p.id = d."productId"
         LEFT JOIN in_categories c ON c.id = p."categoryId"
        WHERE d."deletedAt" IS NULL
          AND d."saleDetailStatus" = 'CONFIRMED'
          AND ${this.revenueSalesSql(scope, period, currency, params)}
        GROUP BY 1, 2, 3
        ORDER BY quantity DESC, name
        LIMIT ${RANKING_SIZE}`,
      params,
    );
    return rows.map((row) => this.toRanking(row));
  }

  private async sellerRanking(
    scope: Scope,
    period: Period,
    currency: string | null,
  ) {
    const params = new QueryParams();
    const rows = await this.query(
      `SELECT w.id AS id,
              COALESCE(
                NULLIF(trim(concat(u.name, ' ', u."lastName")), ''),
                NULLIF(trim(concat(w."tempFirstName", ' ', w."tempLastName")), ''),
                'Sin vendedor'
              ) AS name,
              NULL AS detail,
              COALESCE(sum(s."totalAmount" - COALESCE(s."refundedAmount", 0)), 0) AS amount,
              0 AS quantity,
              count(*) AS count
         FROM sl_sales s
         LEFT JOIN py_workers w ON w.id = s."salesWorkerId"
         LEFT JOIN users u ON u.id = w."userId"
        WHERE ${this.revenueSalesSql(scope, period, currency, params)}
        GROUP BY 1, 2
        ORDER BY amount DESC, name
        LIMIT ${RANKING_SIZE}`,
      params,
    );
    return rows.map((row) => this.toRanking(row));
  }

  private async customerRanking(
    scope: Scope,
    period: Period,
    currency: string | null,
  ) {
    const params = new QueryParams();
    const rows = await this.query(
      `SELECT c.id AS id,
              COALESCE(
                NULLIF(trim(c."fullName"), ''),
                NULLIF(trim(concat(c.name, ' ', c."lastName")), '')
              ) AS name,
              c.phone AS detail,
              COALESCE(sum(s."totalAmount" - COALESCE(s."refundedAmount", 0)), 0) AS amount,
              0 AS quantity,
              count(*) AS count
         FROM sl_sales s
         JOIN sl_customers c ON c.id = s."customerId"
        WHERE ${this.revenueSalesSql(scope, period, currency, params)}
        GROUP BY 1, 2, 3
        ORDER BY amount DESC, name
        LIMIT ${RANKING_SIZE}`,
      params,
    );
    return rows.map((row) => this.toRanking(row));
  }

  /** What was collected with each payment method, in the reported currency */
  private async paymentMethods(
    scope: Scope,
    period: Period,
    currency: string | null,
  ) {
    const params = new QueryParams();
    const paymentCurrency = params.add(currency);
    const rows = await this.query(
      `SELECT COALESCE(payment->>'paymentMethod', 'OTHER') AS key,
              count(*) AS count,
              COALESCE(sum((payment->>'amount')::numeric), 0) AS amount
         FROM sl_sales s
        CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(s.payments) = 'array'
                     THEN s.payments ELSE '[]'::jsonb END
              ) AS payment
        WHERE ${this.revenueSalesSql(scope, period, currency, params)}
          AND payment->>'currency' = ${paymentCurrency}
        GROUP BY 1
        ORDER BY amount DESC`,
      params,
    );
    return rows.map((row) => ({
      key: row.key,
      count: Number(row.count),
      amount: Number(row.amount),
    }));
  }

  /** New customers bought for the first time inside the period */
  private async customerMix(
    scope: Scope,
    period: Period,
    currency: string | null,
  ) {
    const params = new QueryParams();
    const firstScope = this.scopeSql('f', scope, params);
    const statuses = params.add(REVENUE_STATUSES);
    const from = params.add(period.from);
    const [row] = await this.query(
      `WITH buyers AS (
         SELECT s."customerId" AS id, count(*) AS sales
           FROM sl_sales s
          WHERE ${this.revenueSalesSql(scope, period, currency, params)}
          GROUP BY 1
       ),
       first_purchase AS (
         SELECT f."customerId" AS id,
                min(COALESCE(f."effectiveDate", f."createdAt")) AS first_at
           FROM sl_sales f
          WHERE ${firstScope}
            AND f."saleStatus" = ANY(${statuses}::"sl_sales_salestatus_enum"[])
            AND f."customerId" IS NOT NULL
          GROUP BY 1
       )
       SELECT count(*) FILTER (WHERE b.id IS NOT NULL AND fp.first_at >= ${from}::date) AS new_customers,
              count(*) FILTER (WHERE b.id IS NOT NULL AND fp.first_at < ${from}::date) AS returning_customers,
              COALESCE(sum(b.sales) FILTER (WHERE b.id IS NULL), 0) AS anonymous_sales
         FROM buyers b
         LEFT JOIN first_purchase fp ON fp.id = b.id`,
      params,
    );
    return {
      newCustomersCount: Number(row.new_customers),
      returningCustomersCount: Number(row.returning_customers),
      anonymousSalesCount: Number(row.anonymous_sales),
    };
  }

  private async draftSalesCount(scope: Scope): Promise<number> {
    const params = new QueryParams();
    const [row] = await this.query(
      `SELECT count(*) AS count
         FROM sl_sales s
        WHERE ${this.scopeSql('s', scope, params)}
          AND s."saleStatus" = 'DRAFT'`,
      params,
    );
    return Number(row.count);
  }

  // ---------------------------------------------------------------------------
  // Inventory, payroll and attendance
  // ---------------------------------------------------------------------------

  private lowStockSql(scope: Scope, params: QueryParams): string {
    return `FROM in_inventories i
            JOIN in_products p ON p.id = i."productId" AND p."deletedAt" IS NULL
           WHERE ${this.scopeSql('i', scope, params)}
             AND i."minStock" IS NOT NULL
             AND i."currentStock" <= i."minStock"`;
  }

  private async lowStock(scope: Scope) {
    const params = new QueryParams();
    const rows = await this.query(
      `SELECT i.id AS "inventoryId", p.name AS product, i.location,
              i."currentStock", i."minStock"
         ${this.lowStockSql(scope, params)}
        ORDER BY (i."currentStock" - i."minStock"), p.name
        LIMIT ${LOW_STOCK_SIZE}`,
      params,
    );
    return rows.map((row) => ({
      inventoryId: row.inventoryId,
      product: row.product,
      location: row.location,
      currentStock: Number(row.currentStock),
      minStock: Number(row.minStock),
    }));
  }

  private async lowStockCount(scope: Scope): Promise<number> {
    const params = new QueryParams();
    const [row] = await this.query(
      `SELECT count(*) AS count ${this.lowStockSql(scope, params)}`,
      params,
    );
    return Number(row.count);
  }

  /** Payments to workers that have not been carried out yet */
  private async pendingWorkerPayments(scope: Scope) {
    const params = new QueryParams();
    const rows = await this.query(
      `SELECT wp.currency, count(*) AS count, COALESCE(sum(wp.amount), 0) AS amount
         FROM py_worker_payments wp
        WHERE ${this.scopeSql('wp', scope, params)}
          AND wp."paidDate" IS NULL
        GROUP BY 1
        ORDER BY amount DESC`,
      params,
    );
    return rows.map((row) => this.toAmount(row));
  }

  private async payrollPaid(scope: Scope, period: Period) {
    const params = new QueryParams();
    const paidAt = `(wp."paidDate" + make_interval(mins => ${params.add(period.shiftMinutes)}::int))`;
    const rows = await this.query(
      `SELECT wp.currency, count(*) AS count, COALESCE(sum(wp.amount), 0) AS amount
         FROM py_worker_payments wp
        WHERE ${this.scopeSql('wp', scope, params)}
          AND ${paidAt} >= ${params.add(period.from)}::date
          AND ${paidAt} < ${params.add(period.toExclusive)}::date
        GROUP BY 1
        ORDER BY amount DESC`,
      params,
    );
    return rows.map((row) => this.toAmount(row));
  }

  private async attendance(scope: Scope, period: Period) {
    const params = new QueryParams();
    const rows = await this.query(
      `SELECT a.status AS key, count(*) AS count
         FROM py_attendances a
        WHERE ${this.scopeSql('a', scope, params)}
          AND a."attendanceDate" >= ${params.add(period.from)}::date
          AND a."attendanceDate" < ${params.add(period.toExclusive)}::date
        GROUP BY 1
        ORDER BY 2 DESC`,
      params,
    );
    return rows.map((row) => ({
      key: row.key,
      count: Number(row.count),
      amount: 0,
    }));
  }

  private async countRows(table: string, scope: Scope): Promise<number> {
    const params = new QueryParams();
    const [row] = await this.query(
      `SELECT count(*) AS count FROM ${table} t WHERE ${this.scopeSql('t', scope, params)}`,
      params,
    );
    return Number(row.count);
  }

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  private toRanking(row: Row) {
    return {
      id: row.id,
      name: row.name ?? 'Sin nombre',
      detail: row.detail,
      amount: Number(row.amount),
      quantity: Number(row.quantity),
      count: Number(row.count),
    };
  }

  private toAmount(row: Row) {
    return {
      currency: row.currency,
      amount: Number(row.amount),
      count: Number(row.count),
    };
  }
}
