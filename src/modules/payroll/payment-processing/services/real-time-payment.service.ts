import { Injectable, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';

import { Sale } from '../../../sales/sale/entities/sale.entity';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';

import { PaymentType } from '../../payment-rule/enums/payment-type.enum';
import { PaymentConcept } from '../../worker-payment/enums/payment-concept.enum';

import { PercentageProcessor } from './payment-processors/percentage-processor';
import { SaleQuantityProcessor } from './payment-processors/sale-quantity-processor';
import { PriceRangeProcessor } from './payment-processors/price-range-processor';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { SaleService } from '../../../sales/sale/services/sale.service';
import { PaymentRuleService } from '../../payment-rule/services/payment-rule.service';
import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { WorkerPaymentService } from '../../worker-payment/services/worker-payment.service';
import { PaymentAccumulatorService } from '../../payment_accumulator/services/payment-accumulator.service';
import { PaymentAccumulator } from '../../payment_accumulator/entities/payment_accumulator.entity';
import { PaymentMethod } from '../../worker-payment/enums/payment-method.enum';
import { RealTimeCalculationResult } from '../types/real-time-calculation.types';
import { WorkerPayment } from '../../worker-payment/entities/worker-payment.entity';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';

/** Lo que una venta aportó a un acumulador, para poder restarlo al recalcular */
interface SaleContribution {
  units: number;
  amount: number;
  salesTotal: number;
}

/** Lo que guarda el acumulador en `metadata` */
type AccumulatorMetadata = Record<string, unknown> & {
  bySale?: Record<string, SaleContribution>;
};

const metadataOf = (accumulator: PaymentAccumulator): AccumulatorMetadata =>
  (accumulator.metadata ?? {}) as AccumulatorMetadata;

/**
 * Comisiones de una venta. Se puede recalcular cuantas veces haga falta: lo
 * que aún no se ha pagado se borra y se vuelve a calcular con la venta como
 * está (sin las líneas devueltas); lo ya pagado, revertido o compensado no se
 * toca, y su regla no se vuelve a aplicar a esa venta.
 */
@Injectable()
export class RealTimePaymentService {
  REAL_TIME_PAYMENT_TYPES = [
    PaymentType.PRICE_RANGE,
    PaymentType.SALE_QUANTITY,
    PaymentType.PERCENTAGE,
  ];

  constructor(
    private readonly saleService: SaleService,
    private readonly paymentRuleService: PaymentRuleService,
    private readonly payrollPeriodService: PayrollPeriodService,
    private readonly workerPaymentService: WorkerPaymentService,
    private readonly paymentAccumulatorService: PaymentAccumulatorService,

    @Inject(PercentageProcessor)
    private readonly percentageProcessor: PercentageProcessor,

    @Inject(SaleQuantityProcessor)
    private readonly saleQuantityProcessor: SaleQuantityProcessor,

    @Inject(PriceRangeProcessor)
    private readonly priceRangeProcessor: PriceRangeProcessor,
  ) {}

  /**
   * Calcula las comisiones de una venta. Con `period` se usan para ese
   * período (el cálculo de un período); sin él, el que contiene la fecha.
   */
  async processSale(
    saleId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
    period?: PayrollPeriod,
  ): Promise<{
    paymentsCreated: number;
    totalAmount: number;
    details: any[];
  }> {
    const details: any[] = [];
    let totalPaymentsCreated = 0;
    let totalAmount = 0;

    const sale = await this.saleService.findOne(saleId, cu, scopes, manager);
    if (!sale?.isConfirmed) {
      throw new BadRequestError(`La venta #${saleId} no está cobrada`);
    }

    const payrollPeriod =
      period ??
      (await this.payrollPeriodService.getCurrentOrCreatePeriod(
        sale.effectiveDate || new Date(),
        cu,
        [ScopedAccessEnum.BUSINESS],
        manager,
      ));

    // 1. Lo calculado antes: se respeta lo pagado, el resto se rehace
    const keptRuleIds = await this.clearUnpaidPayments(
      sale,
      payrollPeriod,
      cu,
      scopes,
      manager,
    );

    // 2. Reglas activas que aplican a la venta
    const allRules = (
      await this.paymentRuleService.find(
        {
          filters: [
            {
              property: 'isActive',
              operator: ConditionalOperator.EQUAL,
              value: 'true',
            },
          ],
        },
        cu,
        scopes,
        manager,
      )
    ).data as Array<PaymentRule>;

    const applicableRules = allRules.filter(
      (rule) =>
        this.REAL_TIME_PAYMENT_TYPES.includes(rule.paymentType) &&
        !keptRuleIds.has(rule.id as number) &&
        this.doesRuleApplyToSale(rule, sale),
    );

    // 3. Cada regla por separado: una que falla no impide las demás
    for (const rule of applicableRules) {
      try {
        const ruleResult = await this.processRuleForSale(
          rule,
          sale,
          payrollPeriod,
          cu,
          scopes,
          manager,
        );
        if (ruleResult.paymentsCreated > 0) {
          totalPaymentsCreated += ruleResult.paymentsCreated;
          totalAmount += ruleResult.totalAmount;
          details.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.paymentType,
            currency: rule.paymentCurrency,
            paymentsCreated: ruleResult.paymentsCreated,
            totalAmount: ruleResult.totalAmount,
            workerPayments: ruleResult.workerPayments,
          });
        }
      } catch (ruleError) {
        details.push({
          ruleId: rule.id,
          ruleName: rule.name,
          error:
            ruleError instanceof Error ? ruleError.message : String(ruleError),
        });
      }
    }

    return {
      paymentsCreated: totalPaymentsCreated,
      totalAmount,
      details,
    };
  }

  /**
   * Borra los pagos no pagados de la venta y resta de los acumuladores lo que
   * la venta les había sumado. Devuelve las reglas con pagos ya hechos.
   */
  private async clearUnpaidPayments(
    sale: Sale,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Set<number>> {
    const existing = (
      await this.workerPaymentService.find(
        {
          skip: 0,
          filters: [
            {
              property: 'sale.id',
              operator: ConditionalOperator.EQUAL,
              value: String(sale.id),
            },
          ],
        },
        cu,
        scopes,
        manager,
      )
    ).data as WorkerPayment[];

    const isKept = (payment: WorkerPayment) =>
      !!payment.paidDate ||
      !!payment.breakdown?.reversed ||
      payment.breakdown?.ruleType === 'COMPENSATION';
    const keptRuleIds = new Set(
      existing
        .filter(isKept)
        .map((payment) => payment.paymentRule?.id)
        .filter((id): id is number => !!id),
    );

    const unpaid = existing.filter(
      (payment) =>
        !isKept(payment) && !keptRuleIds.has(payment.paymentRule?.id as number),
    );
    if (unpaid.length) {
      await this.workerPaymentService.remove(
        unpaid.map((payment) => payment.id as number),
        cu,
        scopes,
        manager,
      );
    }

    // Lo que la venta sumó a cada acumulador del período
    const repository = manager
      ? manager.getRepository(PaymentAccumulator)
      : this.paymentAccumulatorService.getRepository();
    const accumulators = await repository.find({
      where: { payrollPeriod: { id: payrollPeriod.id } },
      relations: { paymentRule: true },
    });
    const key = String(sale.id);
    for (const accumulator of accumulators) {
      const bySale = { ...(metadataOf(accumulator).bySale ?? {}) };
      const contribution = bySale[key];
      if (
        !contribution ||
        keptRuleIds.has(accumulator.paymentRule?.id as number)
      ) {
        continue;
      }
      delete bySale[key];
      await repository.save({
        id: accumulator.id,
        productCounter: Math.max(
          0,
          Number(accumulator.productCounter || 0) - contribution.units,
        ),
        accumulatedAmount: Math.max(
          0,
          Number(accumulator.accumulatedAmount || 0) - contribution.amount,
        ),
        salesTotal: Math.max(
          0,
          Number(accumulator.salesTotal || 0) - contribution.salesTotal,
        ),
        metadata: { ...metadataOf(accumulator), bySale },
      });
    }

    return keptRuleIds;
  }

  /** Una regla de producto o categoría solo aplica si la venta lo incluye */
  private doesRuleApplyToSale(rule: PaymentRule, sale: Sale): boolean {
    if (!rule.product?.id && !rule.category?.id) return true;
    return (sale.details || []).some(
      (detail) =>
        (rule.product?.id && detail.product?.id === rule.product.id) ||
        (rule.category?.id &&
          detail.product?.category?.id === rule.category.id),
    );
  }

  private async processRuleForSale(
    rule: PaymentRule,
    sale: Sale,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<{
    paymentsCreated: number;
    totalAmount: number;
    workerPayments: Array<{
      workerId: number;
      amount: number;
      paymentId?: number;
    }>;
  }> {
    let calculationResult: RealTimeCalculationResult;
    switch (rule.paymentType) {
      case PaymentType.PERCENTAGE:
        calculationResult = await this.percentageProcessor.realTimeCalculate(
          rule,
          sale,
          payrollPeriod,
          cu,
          scopes,
          manager,
        );
        break;
      case PaymentType.SALE_QUANTITY:
        calculationResult = await this.saleQuantityProcessor.realTimeCalculate(
          rule,
          sale,
          payrollPeriod,
          cu,
          scopes,
          manager,
        );
        break;
      case PaymentType.PRICE_RANGE:
        calculationResult = await this.priceRangeProcessor.realTimeCalculate(
          rule,
          sale,
          payrollPeriod,
          cu,
          scopes,
          manager,
        );
        break;
      default:
        // El importe fijo se calcula por período, no por venta
        return { paymentsCreated: 0, totalAmount: 0, workerPayments: [] };
    }

    const workerPayments: Array<{
      workerId: number;
      amount: number;
      paymentId?: number;
    }> = [];
    let totalAmount = 0;

    for (const workerPayment of calculationResult.workerPayments) {
      const units = Number(
        (workerPayment.calculationDetails as { productCount?: number })
          ?.productCount ?? 0,
      );
      // Sin importe ni unidades contadas no hay nada que anotar
      if (workerPayment.amount <= 0 && units <= 0) continue;

      const accumulator = await this.recordContribution(
        rule,
        sale,
        payrollPeriod,
        workerPayment,
        units,
        cu,
        scopes,
        manager,
      );
      if (workerPayment.amount <= 0) continue;

      const createdPayment = await this.workerPaymentService.create(
        {
          workerId: workerPayment.workerId,
          saleId: sale.id,
          payrollPeriodId: payrollPeriod.id as number,
          paymentRuleId: rule.id,
          amount: Math.round(workerPayment.amount * 100) / 100,
          currency: workerPayment.currency,
          paymentConcept: PaymentConcept.COMMISSION,
          paymentMethod: PaymentMethod.CASH,
          breakdown: {
            ...workerPayment.calculationDetails,
            roleInSale: workerPayment.roleInSale,
            saleId: sale.id,
            saleDate: sale.effectiveDate,
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.paymentType,
            distributeProfits: rule.distributeProfits,
            accumulatorId: accumulator.id,
            calculationSummary: calculationResult.ruleSummary,
          },
          notes: `Venta #${sale.id} · ${rule.name}`,
        },
        cu,
        scopes,
        manager,
      );

      workerPayments.push({
        workerId: workerPayment.workerId,
        amount: workerPayment.amount,
        paymentId: createdPayment.id,
      });
      totalAmount += workerPayment.amount;
    }

    return {
      paymentsCreated: workerPayments.length,
      totalAmount,
      workerPayments,
    };
  }

  /**
   * Suma al acumulador del trabajador lo que aporta la venta (unidades,
   * importe, total vendido) y lo anota por venta para poder restarlo.
   */
  private async recordContribution(
    rule: PaymentRule,
    sale: Sale,
    payrollPeriod: PayrollPeriod,
    workerPayment: RealTimeCalculationResult['workerPayments'][number],
    units: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentAccumulator> {
    const repository = manager
      ? manager.getRepository(PaymentAccumulator)
      : this.paymentAccumulatorService.getRepository();
    const accumulator = await repository.findOne({
      where: {
        worker: { id: workerPayment.workerId },
        paymentRule: { id: rule.id },
        payrollPeriod: { id: payrollPeriod.id },
      },
    });

    const previousSalesTotal = Number(accumulator?.salesTotal || 0);
    const salesTotal =
      workerPayment.accumulatorUpdate?.salesTotal ?? previousSalesTotal;
    const contribution: SaleContribution = {
      units,
      amount: workerPayment.amount,
      salesTotal: Math.max(0, Number(salesTotal) - previousSalesTotal),
    };

    if (accumulator) {
      const bySale = { ...(metadataOf(accumulator).bySale ?? {}) };
      bySale[String(sale.id)] = contribution;
      await repository.save({
        id: accumulator.id,
        productCounter: Number(accumulator.productCounter || 0) + units,
        accumulatedAmount:
          Number(accumulator.accumulatedAmount || 0) + workerPayment.amount,
        salesTotal: previousSalesTotal + contribution.salesTotal,
        metadata: { ...metadataOf(accumulator), bySale },
      });
      return accumulator;
    }

    return this.paymentAccumulatorService.create(
      {
        workerId: workerPayment.workerId,
        paymentRuleId: rule.id as number,
        payrollPeriodId: payrollPeriod.id as number,
        productCounter: units,
        salesTotal: contribution.salesTotal,
        accumulatedAmount: workerPayment.amount,
        accumulatedCurrency: 0,
        metadata: {
          ruleType: rule.paymentType,
          distributeProfits: rule.distributeProfits,
          bySale: { [String(sale.id)]: contribution },
        },
      },
      cu,
      scopes,
      manager,
    );
  }
}
