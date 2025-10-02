/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ListOptions } from '../../../../core/graphql/remote-operations';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';

import { PayrollPeriodService } from '../../payroll-period/services/payroll-period.service';
import { WorkerService } from '../../worker/services/worker.service';
import { ProcessPaymentsInput } from '../dto/process-payments.input';
import { SaleService } from '../../../sales/sale/services/sale.service';
import { PaymentProcessingSummary } from '../types/payment-processing-summary.type';
import { PaymentProcessingResult } from '../types/payment-processing-result.type';
import { PayrollPeriod } from '../../payroll-period/entities/payroll-period.entity';
import { Worker } from '../../worker/entities/worker.entity';
import { PaymentRuleService } from '../../payment-rule/services/payment-rule.service';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { BusinessService } from '../../../company/business/services/business.service';
import { OfficeService } from '../../../company/office/services/office.service';
import { DepartmentService } from '../../../company/department/services/department.service';
import { TeamService } from '../../../company/team/services/team.service';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { Office } from '../../../company/office/entities/co_office.entity';
import { Department } from '../../../company/department/entities/co_department.entity';
import { PaymentType } from '../../payment-rule/enums/payment-type.enum';
import { Sale } from '../../../sales/sale/entities/sale.entity';
import { AttendanceService } from '../../attendance/services/attendance.service';
import { Attendance } from '../../attendance/entities/attendance.entity';

@Injectable()
export class PaymentProcessingService {
  constructor(
    private readonly workerService: WorkerService,
    private readonly payrollPeriodService: PayrollPeriodService,
    private readonly saleService: SaleService,
    private readonly paymentRuleService: PaymentRuleService,
    private readonly attendanceService: AttendanceService,
    protected readonly scopedAccessService: ScopedAccessService,

    protected readonly businessService: BusinessService,
    protected readonly officeService: OfficeService,
    protected readonly departmentService: DepartmentService,
    protected readonly teamService: TeamService,
  ) {}

  async getProcessingStatus(
    payrollPeriodId: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingSummary> {
    // Implementar lógica para obtener el estado del procesamiento
    throw new Error('Method not implemented');
  }

  async getProcessedPayments(
    payrollPeriodId: number,
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingSummary> {
    // Implementar lógica para obtener pagos procesados
    throw new Error('Method not implemented');
  }

  async processPayments(
    input: ProcessPaymentsInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingSummary> {
    // 1. Validar periodo de nómina
    const payrollPeriod = await this.payrollPeriodService.validatePeriod(
      input.payrollPeriodId,
      cu,
      scopes,
      manager,
    );

    // 2. Obtener workers según filtros
    const workers = (
      await this.workerService.findWorkersByScope(
        {
          businessId: input.businessId,
          officeId: input.officeId,
          departmentId: input.departmentId,
          teamId: input.teamId,
          workerIds: input.workerIds,
        },
        cu,
        scopes,
        manager,
      )
    ).data as Array<Worker>;

    const results: PaymentProcessingResult[] = [];

    // 3. Procesar cada worker
    for (const worker of workers) {
      try {
        const result = await this.processWorkerPayment(
          worker,
          payrollPeriod,
          input.force || false,
          cu,
          scopes,
          manager,
        );

        results.push(result);
      } catch (error) {
        results.push({
          workerId: worker.id as number,
          workerName:
            worker.user?.fullName ||
            `${worker.tempFirstName} ${worker.tempLastName}`,
          amount: 0,
          currency: 'CUP',
          paymentConcept: 'ERROR',
          status: 'ERROR',
          errors: [error.message],
          details: null,
        });
      }
    }

    return {
      data: results,
      totalCount: results.length,
      successCount: results.filter((r) => r.status === 'SUCCESS').length,
      errorCount: results.filter((r) => r.status === 'ERROR').length,
    };
  }

  private async processWorkerPayment(
    worker: Worker,
    payrollPeriod: PayrollPeriod,
    force: boolean,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentProcessingResult> {
    try {
      // 1. Obtener las reglas de pago de acuerdo al workerType y otherType
      const paymentRules =
        await this.paymentRuleService.findPaymentRulesByWorkerType(
          worker.workerType,
          worker.otherType,
          cu,
          scopes,
          manager,
        );

      let totalPayment = 0;
      const paymentBreakdown: any[] = [];

      // 2. Procesar cada regla de pago
      for (const paymentRule of paymentRules) {
        if (!paymentRule.isActive) continue;

        let paymentAmount = 0;

        switch (paymentRule.paymentType) {
          case PaymentType.FIXED_AMOUNT:
            paymentAmount = await this.processFixedAmountPayment(
              worker,
              paymentRule,
              payrollPeriod,
              cu,
              scopes,
              manager,
            );
            break;

          case PaymentType.PERCENTAGE:
            paymentAmount = await this.processPercentagePayment(
              worker,
              paymentRule,
              payrollPeriod,
              cu,
              scopes,
              manager,
            );
            break;

          case PaymentType.SALE_QUANTITY:
            paymentAmount = await this.processSaleQuantityPaymentActual(
              worker,
              paymentRule,
              payrollPeriod,
              cu,
              scopes,
              manager,
            );
            break;

          case PaymentType.PRICE_RANGE:
            paymentAmount = await this.processPriceRangePayment(
              worker,
              paymentRule,
              payrollPeriod,
              cu,
              scopes,
              manager,
            );
            break;
        }

        totalPayment += paymentAmount;
        paymentBreakdown.push({
          ruleId: paymentRule.id,
          ruleName: paymentRule.name,
          ruleType: paymentRule.paymentType,
          amount: paymentAmount,
          currency: paymentRule.paymentCurrency,
        });
      }

      // 3. Crear registro de pago
      // const paymentRecord = await this.paymentBatchService.createPayment(
      //   worker,
      //   {
      //     totalAmount: totalPayment,
      //     currency: 'CUP', // Moneda principal por defecto
      //     paymentConcept: 'Nómina período',
      //     breakdown: paymentBreakdown,
      //   },
      //   payrollPeriod,
      //   cu,
      //   scopes,
      //   manager,
      // );

      return {
        workerId: worker.id as number,
        workerName:
          worker.user?.fullName ||
          `${worker.tempFirstName} ${worker.tempLastName}`,
        amount: totalPayment,
        currency: 'CUP',
        paymentConcept: 'Nómina período',
        status: 'SUCCESS',
        errors: [],
        details: { paymentBreakdown },
      };
    } catch (error) {
      return {
        workerId: worker.id as number,
        workerName:
          worker.user?.fullName ||
          `${worker.tempFirstName} ${worker.tempLastName}`,
        amount: 0,
        currency: 'CUP',
        paymentConcept: 'ERROR',
        status: 'ERROR',
        errors: [error.message],
        details: null,
      };
    }
  }

  // private async processWorkerPaymentViejo(
  //   worker: Worker,
  //   payrollPeriod: PayrollPeriod,
  //   force: boolean,
  //   cu?: JWTPayload,
  //   scopes?: ScopedAccessEnum[],
  //   manager?: EntityManager,
  // ): Promise<PaymentProcessingResult> {
  //   // 1. Obtener el rango de fechas del periodo
  //   const startDate = new Date(payrollPeriod.startDate);
  //   const endDate = new Date(payrollPeriod.endDate);

  //   // 2. Iterar día por día
  //   const currentDate = new Date(startDate);

  //   while (currentDate <= endDate) {
  //     try {
  //       // 1. Obtener las reglas de pago de acuerdo al workerType y otherType.
  //       // 2. prosesar con un swith case de acuerdo al paymentType. (quiero un metodo auciliar por independiente para el procesamiento de cada paymentType)
  //       //    -- Para FIXED_AMOUNT:
  //       //      1. ver el scope, si es a nivel de negocio el pago es el monto fijo de la regla. si es a nivel de oficina el pago es el monto.
  //       //        fijo por la cantidad de oficinas de ese negocio, si es departamento es el monto fijo por la cantidad de departamentos y de oficinas y asi sucesivamente.
  //       //      2 .hacer el pago a ese worker por el monto que proceda
  //       //    -- Para PERCENTAGE, ver el scope y buscar en ese scope todas las ventas sacar el porciento y hacer el pago.
  //       //    -- Para SALE_QUANTITY:
  //       //      1. Determinar conjunto de ventas:
  //       //      - Si distributeProfits(false): solo ventas del trabajador actual
  //       //      - Si distributeProfits(true): todas las ventas del scope
  //       //      2. Calcular monto total aplicando reglas a las ventas seleccionadas
  //       //      3. Distribuir el monto:
  //       //      - distributeProfits(false): asignar monto completo al trabajador actual
  //       //      - distributeProfits(true): dividir monto total entre todos los trabajadores con asistencia
  //       //    -- Para PRICE_RANGE:
  //       //      1. Determinar conjunto de ventas:
  //       //      - Si distributeProfits(false): solo ventas del trabajador actual
  //       //      - Si distributeProfits(true): todas las ventas del scope
  //       //      2. Calcular monto total aplicando reglas (por rango de precios) a las ventas seleccionadas
  //       //      3. Distribuir el monto:
  //       //      - distributeProfits(false): asignar monto completo al trabajador actual
  //       //      - distributeProfits(true): dividir monto total entre todos los trabajadores con asistencia

  //       // Avanzar al siguiente día
  //       currentDate.setDate(currentDate.getDate() + 1);
  //     } catch (error) {
  //       console.error(
  //         `Error processing day ${currentDate.toISOString().split('T')[0]} for worker ${worker.id}:`,
  //         error,
  //       );
  //     }
  //   }

  //   // 1. Obtener ventas del worker en el periodo
  //   const sales = await this.saleService.getWorkerSales(
  //     worker.id,
  //     payrollPeriod.startDate,
  //     payrollPeriod.endDate,
  //     cu,
  //     scopes,
  //     manager,
  //   );

  //   // 2. Aplicar reglas de pago
  //   const paymentRules = await this.paymentRuleEngineService.applyRules(
  //     worker,
  //     sales,
  //     cu,
  //     scopes,
  //     manager,
  //   );

  //   // 3. Calcular pago total
  //   const paymentCalculation =
  //     await this.workerPaymentCalculatorService.calculatePayment(
  //       worker,
  //       paymentRules,
  //       sales,
  //       payrollPeriod,
  //       cu,
  //       scopes,
  //       manager,
  //     );

  //   // 4. Crear registro de pago
  //   const paymentRecord = await this.paymentBatchService.createPayment(
  //     worker,
  //     paymentCalculation,
  //     payrollPeriod,
  //     cu,
  //     scopes,
  //     manager,
  //   );

  //   return {
  //     workerId: worker.id,
  //     workerName:
  //       worker.user?.fullName ||
  //       `${worker.tempFirstName} ${worker.tempLastName}`,
  //     amount: paymentCalculation.totalAmount,
  //     currency: paymentCalculation.currency,
  //     paymentConcept: paymentCalculation.paymentConcept,
  //     status: 'SUCCESS',
  //     errors: [],
  //     details: paymentCalculation.breakdown,
  //   };
  // }

  // async reprocessPayment(
  //   input: ReprocessPaymentInput,
  //   cu?: JWTPayload,
  //   scopes?: ScopedAccessEnum[],
  //   manager?: EntityManager,
  // ): Promise<PaymentProcessingResult> {
  //   // Implementar reprocesamiento de pago específico
  //   throw new Error('Method not implemented');
  // }

  async approvePayments(
    paymentIds: number[],
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    // Implementar aprobación de pagos
    throw new Error('Method not implemented');
  }

  async rejectPayments(
    paymentIds: number[],
    reason: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    // Implementar rechazo de pagos
    throw new Error('Method not implemented');
  }

  private async processFixedAmountPayment(
    worker: Worker,
    paymentRule: PaymentRule,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    const fixedAmount = paymentRule.conditions.fixedAmount?.amount || 0;

    if (!worker.business?.id) {
      throw new Error(
        'Worker must have a business assigned for fixed amount calculation',
      );
    }

    const businessId = worker.business.id;

    switch (paymentRule.scope) {
      case ScopedAccessEnum.BUSINESS:
        // Monto fijo a nivel de negocio
        return fixedAmount;

      case ScopedAccessEnum.OFFICE: {
        // Monto fijo por cantidad de oficinas en el negocio
        const officeCount = (
          await this.officeService.find(
            {
              filters: [
                {
                  property: 'business.id',
                  operator: ConditionalOperator.EQUAL,
                  value: String(businessId),
                },
              ],
              take: 0,
            },
            cu,
            scopes,
            manager,
          )
        ).totalCount;
        return fixedAmount * officeCount;
      }

      case ScopedAccessEnum.DEPARTMENT: {
        // Monto fijo por cantidad de departamentos en el negocio
        const departmentCount = (
          await this.departmentService.find(
            {
              filters: [
                {
                  property: 'business.id',
                  operator: ConditionalOperator.EQUAL,
                  value: String(businessId),
                },
              ],
              take: 0,
            },
            cu,
            scopes,
            manager,
          )
        ).totalCount;
        return fixedAmount * departmentCount;
      }

      case ScopedAccessEnum.TEAM: {
        // Monto fijo por cantidad de equipos en el negocio
        const teamCount = (
          await this.teamService.find(
            {
              filters: [
                {
                  property: 'business.id',
                  operator: ConditionalOperator.EQUAL,
                  value: String(businessId),
                },
              ],
              take: 0,
            },
            cu,
            scopes,
            manager,
          )
        ).totalCount;
        return fixedAmount * teamCount;
      }

      default:
        return fixedAmount;
    }
  }

  private async processPercentagePayment(
    worker: Worker,
    paymentRule: PaymentRule,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    const percentage = paymentRule.conditions.percentage?.percentage || 0;

    // Obtener ventas según el scope
    const sales = await this.saleService.getSalesByScope(
      {
        worker,
        scope: paymentRule.scope,
        ownSales: false,
        startDate: payrollPeriod.startDate,
        endDate: payrollPeriod.endDate,
        productId: paymentRule.product?.id,
        categoryId: paymentRule.category?.id,
      },
      cu,
      scopes,
      manager,
    );

    const totalSales = sales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0,
    );
    return (totalSales * percentage) / 100;
  }

  private async processSaleQuantityPaymentActual(
    worker: Worker,
    paymentRule: PaymentRule,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    const saleQuantityConditions = paymentRule.conditions.saleQuantity || [];

    // Ordenar condiciones de menor a mayor
    const sortedConditions = [...saleQuantityConditions].sort((a, b) => {
      const aMin = a.minProducts || 0;
      const bMin = b.minProducts || 0;
      return aMin - bMin;
    });

    // Obtener ventas
    const sales = await this.saleService.getSalesByScope(
      {
        worker,
        ownSales: !paymentRule.distributeProfits,
        scope: paymentRule.scope,
        startDate: payrollPeriod.startDate,
        endDate: payrollPeriod.endDate,
        productId: paymentRule.product?.id,
        categoryId: paymentRule.category?.id,
      },
      cu,
      scopes,
      manager,
    );

    let totalAmount = 0;
    const startDate = new Date(payrollPeriod.startDate);
    const endDate = new Date(payrollPeriod.endDate);
    const currentDate = new Date(startDate);

    // Procesar día por día
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];

      // VERIFICAR SI EL TRABAJADOR ASISTIÓ ESTE DÍA
      const workerAttended =
        await this.attendanceService.findDailyAttendanceForWorker(
          worker.id as number,
          currentDate,
          cu,
          scopes,
          manager,
        );

      if (!workerAttended) {
        // Si no asistió, pasar al siguiente día sin calcular pago
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Filtrar ventas del día actual
      const daySales = sales.filter((sale) => {
        if (!sale.effectiveDate) return false;
        const saleDate = new Date(sale.effectiveDate);
        return saleDate.toISOString().split('T')[0] === dateKey;
      });

      // Calcular productos vendidos en el día
      const dayProductCount = daySales.reduce((sum, sale) => {
        const details = Array.isArray(sale.details) ? sale.details : [];
        return (
          sum + details.reduce((acc, detail) => acc + (detail.quantity || 0), 0)
        );
      }, 0);

      if (dayProductCount > 0) {
        // Calcular monto del día aplicando rangos
        let remainingProducts = dayProductCount;
        let dayAmount = 0;

        for (
          let i = 0;
          i < sortedConditions.length && remainingProducts > 0;
          i++
        ) {
          const condition = sortedConditions[i];
          const nextCondition = sortedConditions[i + 1];

          const rangeMin = condition.minProducts || 0;
          const rangeMax = nextCondition ? nextCondition.minProducts : Infinity;
          const rangeSize = rangeMax - rangeMin;

          // Productos en este rango
          const productsInRange = Math.min(remainingProducts, rangeSize);

          if (condition.ratePerProduct) {
            // Pago por tarifa fija
            dayAmount += productsInRange * condition.ratePerProduct;
          } else if (condition.percentagePerProduct) {
            // Pago por porcentaje - calcular monto de venta de estos productos
            let productsToCalculate = productsInRange;
            let salesAmount = 0;

            for (const sale of daySales) {
              const details = Array.isArray(sale.details) ? sale.details : [];
              for (const detail of details) {
                if (productsToCalculate <= 0) break;
                const take = Math.min(
                  productsToCalculate,
                  detail.quantity || 0,
                );
                salesAmount += take * (detail.product.basePrice || 0);
                productsToCalculate -= take;
              }
              if (productsToCalculate <= 0) break;
            }

            dayAmount += (salesAmount * condition.percentagePerProduct) / 100;
          }

          remainingProducts -= productsInRange;
        }

        // Distribuir el monto del día
        if (paymentRule.distributeProfits) {
          // Obtener trabajadores que asistieron este día y cuentan para distribución
          const workersWithAttendance: Array<Attendance> = (
            await this.attendanceService.find({
              filters: [
                {
                  property: 'attendanceDate',
                  operator: ConditionalOperator.EQUAL,
                  value: this.attendanceService.getLocalDateString(currentDate),
                },
              ],
            })
          ).data as Array<Attendance>;

          const workersCount = workersWithAttendance.filter(
            (w) => w.countsForProfitSharing,
          ).length;
          if (workersCount > 0) {
            totalAmount += dayAmount / workersCount;
          }
        } else {
          // Pago individual - todo el monto para el trabajador
          totalAmount += dayAmount;
        }
      }

      // Siguiente día
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalAmount;
  }

  // private async processSaleQuantityPaymentOld(
  //   worker: Worker,
  //   paymentRule: PaymentRule,
  //   payrollPeriod: PayrollPeriod,
  //   cu?: JWTPayload,
  //   scopes?: ScopedAccessEnum[],
  //   manager?: EntityManager,
  // ): Promise<number> {
  //   const saleQuantityConditions = paymentRule.conditions.saleQuantity || [];

  //   // Determinar conjunto de ventas
  //   let sales: Array<Sale>;
  //   if (paymentRule.distributeProfits) {
  //     // Todas las ventas del scope
  //     sales = await this.saleService.getSalesByScope(
  //       {
  //         worker,
  //         ownSales: false,
  //         scope: paymentRule.scope,
  //         startDate: payrollPeriod.startDate,
  //         endDate: payrollPeriod.endDate,
  //         productId: paymentRule.product?.id,
  //         categoryId: paymentRule.category?.id,
  //       },
  //       cu,
  //       scopes,
  //       manager,
  //     );
  //   } else {
  //     // Solo ventas del trabajador actual
  //     sales = await this.saleService.getSalesByScope(
  //       {
  //         worker,
  //         ownSales: true,
  //         scope: paymentRule.scope,
  //         startDate: payrollPeriod.startDate,
  //         endDate: payrollPeriod.endDate,
  //         productId: paymentRule.product?.id,
  //         categoryId: paymentRule.category?.id,
  //       },
  //       cu,
  //       scopes,
  //       manager,
  //     );
  //   }

  //   // Calcular monto total aplicando reglas
  //   const totalAmount = 0;

  //   // Calcular el número total de productos vendidos en un periodo (payrollPeriod)
  //   const productCount = sales.reduce((sum, sale) => {
  //     const details = Array.isArray(sale.details) ? sale.details : [];
  //     return (
  //       sum + details.reduce((acc, detail) => acc + (detail.quantity || 0), 0)
  //     );
  //   }, 0);

  //   // Buscar segun la regla el pago por producto o el % por producto.
  //   let ratePerProduct: number;
  //   let percentagePerProduct: number;
  //   for (const condition of saleQuantityConditions) {
  //     if (productCount <= condition.minProducts || !condition.minProducts) {
  //       if (condition.ratePerProduct) {
  //         ratePerProduct = condition.ratePerProduct;
  //       } else if (condition.percentagePerProduct) {
  //         percentagePerProduct = condition.percentagePerProduct;
  //       }
  //       break; // ← aquí ya no se evalúan más condiciones
  //     }
  //   }

  //   // // Calcular total de ventas (para las reglas que usan porcentaje)
  //   // const totalPay = sales.reduce(
  //   //   (sum, sale) => sum + (sale.totalAmount || 0),
  //   //   0,
  //   // );

  //   // for (const condition of saleQuantityConditions) {
  //   //   if (productCount <= condition.minProducts || !condition.minProducts) {
  //   //     if (condition.ratePerProduct) {
  //   //       totalAmount += productCount * condition.ratePerProduct;
  //   //     } else if (condition.percentagePerProduct) {
  //   //       totalAmount += (totalPay * condition.percentagePerProduct) / 100;
  //   //     }
  //   //     break; // ← aquí ya no se evalúan más condiciones
  //   //   }
  //   // }

  //   // Distribuir el monto
  //   // Obtener el rango de fechas del periodo
  //   const startDate = new Date(payrollPeriod.startDate);
  //   const endDate = new Date(payrollPeriod.endDate);

  //   // Iterar día por día
  //   const currentDate = new Date(startDate);

  //   while (currentDate <= endDate) {
  //     // Avanzar al siguiente día
  //     currentDate.setDate(currentDate.getDate() + 1);
  //   }

  //   if (paymentRule.distributeProfits) {
  //     const workersWithAttendance = await this.getWorkersWithAttendance(
  //       worker.business?.id,
  //       worker.office?.id,
  //       worker.department?.id,
  //       worker.team?.id,
  //       payrollPeriod,
  //       cu,
  //       scopes,
  //       manager,
  //     );
  //     return totalAmount / workersWithAttendance.length;
  //   }

  //   return totalAmount;
  // }

  // private async processPriceRangePayment(
  //   worker: Worker,
  //   paymentRule: PaymentRule,
  //   payrollPeriod: PayrollPeriod,
  //   cu?: JWTPayload,
  //   scopes?: ScopedAccessEnum[],
  //   manager?: EntityManager,
  // ): Promise<number> {
  //   const priceRanges = paymentRule.conditions.priceRanges || [];

  //   // Ordenar rangos de precio de menor a mayor
  //   const sortedRanges = [...priceRanges].sort((a, b) => {
  //     const aMin = a.min ?? 0;
  //     const bMin = b.min ?? 0;
  //     return aMin - bMin;
  //   });

  //   // Obtener ventas
  //   const sales = await this.saleService.getSalesByScope(
  //     {
  //       worker,
  //       ownSales: !paymentRule.distributeProfits,
  //       scope: paymentRule.scope,
  //       startDate: payrollPeriod.startDate,
  //       endDate: payrollPeriod.endDate,
  //       productId: paymentRule.product?.id,
  //       categoryId: paymentRule.category?.id,
  //     },
  //     cu,
  //     scopes,
  //     manager,
  //   );

  //   // Calcular monto total aplicando reglas por rango de precios
  //   let totalAmount = 0;
  //   for (const range of sortedRanges) {
  //     const salesInRange = sales.filter((sale) => {
  //       const saleAmount = sale.totalAmount || 0;
  //       return (
  //         saleAmount >= range.min && (!range.max || saleAmount <= range.max)
  //       );
  //     });

  //     const salesAmountInRange = salesInRange.reduce(
  //       (sum, sale) => sum + (sale.totalAmount || 0),
  //       0,
  //     );

  //     if (range.amount) {
  //       totalAmount += salesInRange.length * range.amount;
  //     } else if (range.percentage) {
  //       totalAmount += (salesAmountInRange * range.percentage) / 100;
  //     }
  //   }

  //   // Distribuir el monto
  //   if (paymentRule.distributeProfits) {
  //     // Obtener trabajadores que asistieron este día y cuentan para distribución
  //     const workersWithAttendance: Array<Attendance> = (
  //       await this.attendanceService.find({
  //         filters: [
  //           {
  //             property: 'attendanceDate',
  //             operator: ConditionalOperator.EQUAL,
  //             value: this.attendanceService.getLocalDateString(currentDate),
  //           },
  //         ],
  //       })
  //     ).data as Array<Attendance>;

  //     const workersCount = workersWithAttendance.filter(
  //       (w) => w.countsForProfitSharing,
  //     ).length;
  //     if (workersCount > 0) {
  //       totalAmount += dayAmount / workersCount;
  //     }
  //   } else {
  //     // Asignar monto completo al trabajador actual
  //     return totalAmount;
  //   }
  // }

  private async processPriceRangePayment(
    worker: Worker,
    paymentRule: PaymentRule,
    payrollPeriod: PayrollPeriod,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<number> {
    const priceRanges = paymentRule.conditions.priceRanges || [];

    // Ordenar rangos de precio de menor a mayor
    const sortedRanges = [...priceRanges].sort((a, b) => {
      const aMin = a.min ?? 0;
      const bMin = b.min ?? 0;
      return aMin - bMin;
    });

    // Obtener ventas según el scope y distributeProfits
    const sales = await this.saleService.getSalesByScope(
      {
        worker,
        ownSales: !paymentRule.distributeProfits, // true = solo ventas del worker, false = todas las ventas del scope
        scope: paymentRule.scope,
        startDate: payrollPeriod.startDate,
        endDate: payrollPeriod.endDate,
        productId: paymentRule.product?.id,
        categoryId: paymentRule.category?.id,
      },
      cu,
      scopes,
      manager,
    );

    let totalAmount = 0;
    const startDate = new Date(payrollPeriod.startDate);
    const endDate = new Date(payrollPeriod.endDate);
    const currentDate = new Date(startDate);

    // Procesar día por día
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];

      // VERIFICAR SI EL TRABAJADOR ASISTIÓ ESTE DÍA
      const workerAttended =
        await this.attendanceService.findDailyAttendanceForWorker(
          worker.id as number,
          currentDate,
          cu,
          scopes,
          manager,
        );

      if (!workerAttended) {
        // Si no asistió, pasar al siguiente día sin calcular pago
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Filtrar ventas del día actual
      const daySales = sales.filter((sale) => {
        if (!sale.effectiveDate) return false;
        const saleDate = new Date(sale.effectiveDate);
        return saleDate.toISOString().split('T')[0] === dateKey;
      });

      if (daySales.length > 0) {
        // Calcular monto del día aplicando rangos de precio
        let dayAmount = 0;

        for (const sale of daySales) {
          const saleAmount = sale.totalAmount || 0;

          // Encontrar el rango que aplica para esta venta
          for (let i = 0; i < sortedRanges.length; i++) {
            const range = sortedRanges[i];
            const nextRange = sortedRanges[i + 1];

            const rangeMin = range.min || 0;
            const rangeMax = nextRange ? nextRange.min : range.max || Infinity;

            // Verificar si la venta cae dentro de este rango
            if (saleAmount >= rangeMin && saleAmount < rangeMax) {
              if (range.amount) {
                // Pago por monto fijo por venta
                dayAmount += range.amount;
              } else if (range.percentage) {
                // Pago por porcentaje del monto de la venta
                dayAmount += (saleAmount * range.percentage) / 100;
              }
              break; // Una vez encontrado el rango, pasar a la siguiente venta
            }
          }
        }

        // Distribuir el monto del día
        if (paymentRule.distributeProfits) {
          // Obtener trabajadores que asistieron este día y cuentan para distribución
          const workersWithAttendance: Array<Attendance> = (
            await this.attendanceService.find(
              {
                filters: [
                  {
                    property: 'attendanceDate',
                    operator: ConditionalOperator.EQUAL,
                    value:
                      this.attendanceService.getLocalDateString(currentDate),
                  },
                  {
                    property: 'countsForProfitSharing',
                    operator: ConditionalOperator.EQUAL,
                    value: 'true',
                  },
                ],
              },
              cu,
              scopes,
              manager,
            )
          ).data as Array<Attendance>;

          const workersCount = workersWithAttendance.length;
          if (workersCount > 0) {
            totalAmount += dayAmount / workersCount;
          }
        } else {
          // Pago individual - todo el monto para el trabajador actual
          totalAmount += dayAmount;
        }
      }

      // Siguiente día
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalAmount;
  }
}
