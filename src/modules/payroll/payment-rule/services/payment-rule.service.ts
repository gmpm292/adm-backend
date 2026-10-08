import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePaymentRuleInput } from '../dto/create-payment-rule.input';
import { UpdatePaymentRuleInput } from '../dto/update-payment-rule.input';
import { BaseService } from '../../../../core/services/base.service';
import { PaymentRule } from '../entities/payment-rule.entity';
import {
  ListFilter,
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';
import { PaymentType } from '../enums/payment-type.enum';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { Conditions } from '../types/conditions.type';
import { ConditionsInput } from '../dto/conditions/conditions-input.dto';
import { ConditionalOperator } from '../../../../core/graphql/remote-operations/enums/conditional-operation.enum';
import { LogicalOperator } from '../../../../core/graphql/remote-operations/enums/logical-operator.enum';
import { WorkerType } from '../../worker/enums/worker-type.enum';
import { ProductService } from '../../../inventory/product/services/product.service';
import { CategoryService } from '../../../inventory/category/services/category.service';
import { WorkerService } from '../../worker/services/worker.service';

@Injectable()
export class PaymentRuleService extends BaseService<PaymentRule> {
  constructor(
    @InjectRepository(PaymentRule)
    private paymentRuleRepository: Repository<PaymentRule>,
    protected scopedAccessService: ScopedAccessService,
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    @Inject(forwardRef(() => WorkerService))
    private readonly workerService: WorkerService,
  ) {
    super(paymentRuleRepository);
  }

  async create(
    createPaymentRuleInput: CreatePaymentRuleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentRule> {
    const paymentRule = new PaymentRule();

    paymentRule.paymentType = createPaymentRuleInput.paymentType;
    paymentRule.name = createPaymentRuleInput.name.trim();
    paymentRule.description = createPaymentRuleInput.description;
    paymentRule.isActive = createPaymentRuleInput.isActive ?? true;
    paymentRule.workerType = createPaymentRuleInput.workerType;
    paymentRule.otherType = createPaymentRuleInput.otherType;
    paymentRule.paymentCurrency = createPaymentRuleInput.paymentCurrency;
    paymentRule.scope = createPaymentRuleInput.scope;
    paymentRule.distributeProfits =
      createPaymentRuleInput.distributeProfits ?? false;

    // Process specific workers if provided
    if (
      createPaymentRuleInput.specificWorkersIds &&
      createPaymentRuleInput.specificWorkersIds.length > 0
    ) {
      const workers = await this.workerService.baseFindByIds({
        ids: createPaymentRuleInput.specificWorkersIds,
        cu,
        scopes,
        manager,
      });
      paymentRule.specificWorkers = workers;
    }

    // Process product if provided
    if (createPaymentRuleInput.productId) {
      paymentRule.product = await this.productService.findOne(
        createPaymentRuleInput.productId,
        cu,
        scopes,
        manager,
      );
    }

    // Process category if provided
    if (createPaymentRuleInput.categoryId) {
      paymentRule.category = await this.categoryService.findOne(
        createPaymentRuleInput.categoryId,
        cu,
        scopes,
        manager,
      );
    }

    // Process conditions based on payment type
    paymentRule.conditions = this.processConditions(
      createPaymentRuleInput.paymentType,
      createPaymentRuleInput.conditions,
    );

    await this.assertUniqueName(
      paymentRule.name,
      createPaymentRuleInput.businessId ?? cu?.businessId,
      undefined,
      manager,
    );

    return super.baseCreate({
      data: paymentRule,
      cu,
      scopes,
      manager,
    });
  }

  /** Las condiciones del tipo de pago, comprobadas y sin campos de más */
  private processConditions(
    paymentType: PaymentType,
    conditions: ConditionsInput,
  ): Conditions {
    const fail = (message: string): never => {
      throw new BadRequestError(message);
    };
    const isSet = (value: unknown) => value !== undefined && value !== null;
    const percent = (value: number | undefined | null) =>
      typeof value === 'number' && value > 0 && value <= 100;

    switch (paymentType) {
      case PaymentType.PRICE_RANGE: {
        const ranges = [...(conditions.priceRanges ?? [])].sort(
          (x, y) => x.min - y.min,
        );
        if (!ranges.length) fail('Añade al menos un rango de precios');
        ranges.forEach((range, index) => {
          if (range.min < 0) {
            fail('El precio mínimo de un rango no puede ser negativo');
          }
          if (isSet(range.max) && range.max <= range.min) {
            fail(
              'En cada rango, el precio máximo debe ser mayor que el mínimo',
            );
          }
          if (isSet(range.amount) === isSet(range.percentage)) {
            fail('Cada rango paga un importe o un porcentaje (uno de los dos)');
          }
          if (isSet(range.amount) && range.amount <= 0) {
            fail('El importe de un rango debe ser mayor que cero');
          }
          if (isSet(range.percentage) && !percent(range.percentage)) {
            fail('El porcentaje de un rango va de 0 a 100');
          }
          const next = ranges[index + 1];
          if (next && (!isSet(range.max) || range.max > next.min)) {
            fail('Los rangos de precios no pueden solaparse');
          }
        });
        return {
          priceRanges: ranges.map((range) => ({
            min: range.min,
            max: range.max ?? null,
            currency: range.currency,
            amount: range.amount ?? undefined,
            percentage: range.percentage ?? undefined,
          })),
        } as Conditions;
      }

      case PaymentType.SALE_QUANTITY: {
        const steps = [...(conditions.saleQuantity ?? [])].sort(
          (x, y) => x.minProducts - y.minProducts,
        );
        if (!steps.length) fail('Añade al menos un escalón de cantidad');
        steps.forEach((step) => {
          if (!(step.minProducts >= 1)) {
            fail('Cada escalón empieza en 1 producto o más');
          }
          if (isSet(step.ratePerProduct) === isSet(step.percentagePerProduct)) {
            fail(
              'Cada escalón paga un importe o un porcentaje por producto (uno de los dos)',
            );
          }
          if (isSet(step.ratePerProduct) && step.ratePerProduct <= 0) {
            fail('El importe por producto debe ser mayor que cero');
          }
          if (
            isSet(step.percentagePerProduct) &&
            !percent(step.percentagePerProduct)
          ) {
            fail('El porcentaje por producto va de 0 a 100');
          }
        });
        if (new Set(steps.map((x) => x.minProducts)).size !== steps.length) {
          fail('Hay dos escalones que empiezan en la misma cantidad');
        }
        return {
          saleQuantity: steps.map((step) => ({
            minProducts: step.minProducts,
            ratePerProduct: step.ratePerProduct ?? undefined,
            percentagePerProduct: step.percentagePerProduct ?? undefined,
          })),
        } as Conditions;
      }

      case PaymentType.FIXED_AMOUNT:
        if (!(conditions.fixedAmount && conditions.fixedAmount.amount > 0)) {
          fail('Indica el importe fijo, mayor que cero');
        }
        return { fixedAmount: { amount: conditions.fixedAmount!.amount } };

      case PaymentType.PERCENTAGE:
        if (!percent(conditions.percentage?.percentage)) {
          fail('Indica el porcentaje, de 0 a 100');
        }
        return {
          percentage: { percentage: conditions.percentage!.percentage },
        };

      default:
        return fail('Tipo de pago desconocido');
    }
  }

  /** Dos reglas de la misma empresa no se llaman igual */
  private async assertUniqueName(
    name: string,
    businessId: number | undefined,
    exceptId: number | undefined,
    manager?: EntityManager,
  ): Promise<void> {
    const repository =
      manager?.getRepository(PaymentRule) ?? this.paymentRuleRepository;
    const query = repository
      .createQueryBuilder('rule')
      .where('LOWER(TRIM(rule.name)) = LOWER(:name)', { name: name.trim() });
    if (businessId) {
      query.andWhere('"rule"."businessId" = :businessId', { businessId });
    }
    if (exceptId) query.andWhere('rule.id != :exceptId', { exceptId });
    if (await query.getCount()) {
      throw new ConflictError(`Ya hay una regla llamada «${name.trim()}»`);
    }
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
      relationsToLoad: ['product', 'category', 'specificWorkers'],
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
  ): Promise<PaymentRule> {
    return super.baseFindOne({
      id,
      relationsToLoad: {
        product: true,
        category: true,
        business: true,
        createdBy: true,
        updatedBy: true,
        specificWorkers: true,
      },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updatePaymentRuleInput: UpdatePaymentRuleInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentRule> {
    const paymentRule = await super.baseFindOne({
      id,
      relationsToLoad: { business: true },
      cu,
      scopes,
      manager,
    });
    if (
      updatePaymentRuleInput.paymentType !== undefined &&
      updatePaymentRuleInput.paymentType !== paymentRule.paymentType &&
      !updatePaymentRuleInput.conditions
    ) {
      throw new BadRequestError(
        'Al cambiar el tipo de pago hay que indicar sus nuevas condiciones',
      );
    }

    // Update fields if provided
    if (updatePaymentRuleInput.paymentType !== undefined) {
      paymentRule.paymentType = updatePaymentRuleInput.paymentType;
    }
    if (updatePaymentRuleInput.name !== undefined) {
      paymentRule.name = updatePaymentRuleInput.name.trim();
      await this.assertUniqueName(
        paymentRule.name,
        paymentRule.business?.id,
        id,
        manager,
      );
    }
    if (updatePaymentRuleInput.description !== undefined) {
      paymentRule.description = updatePaymentRuleInput.description;
    }
    if (updatePaymentRuleInput.isActive !== undefined) {
      paymentRule.isActive = updatePaymentRuleInput.isActive;
    }
    if (updatePaymentRuleInput.workerType !== undefined) {
      paymentRule.workerType = updatePaymentRuleInput.workerType;
    }
    if (updatePaymentRuleInput.otherType !== undefined) {
      paymentRule.otherType = updatePaymentRuleInput.otherType;
    }

    // Process specific workers if provided
    if (
      updatePaymentRuleInput.specificWorkersIds &&
      updatePaymentRuleInput.specificWorkersIds.length > 0
    ) {
      const workers = await this.workerService.baseFindByIds({
        ids: updatePaymentRuleInput.specificWorkersIds,
        cu,
        scopes,
        manager,
      });
      paymentRule.specificWorkers = workers;
    }

    // Update product if provided
    if (updatePaymentRuleInput.productId !== undefined) {
      if (updatePaymentRuleInput.productId) {
        paymentRule.product = await this.productService.findOne(
          updatePaymentRuleInput.productId,
          cu,
          scopes,
          manager,
        );
      } else {
        paymentRule.product = null as unknown as PaymentRule['product'];
      }
    }

    // Update category if provided
    if (updatePaymentRuleInput.categoryId !== undefined) {
      if (updatePaymentRuleInput.categoryId) {
        paymentRule.category = await this.categoryService.findOne(
          updatePaymentRuleInput.categoryId,
          cu,
          scopes,
          manager,
        );
      } else {
        paymentRule.category = null as unknown as PaymentRule['category'];
      }
    }

    if (updatePaymentRuleInput.paymentCurrency !== undefined) {
      paymentRule.paymentCurrency = updatePaymentRuleInput.paymentCurrency;
    }
    if (updatePaymentRuleInput.scope !== undefined) {
      paymentRule.scope = updatePaymentRuleInput.scope;
    }
    if (updatePaymentRuleInput.distributeProfits !== undefined) {
      paymentRule.distributeProfits = updatePaymentRuleInput.distributeProfits;
    }

    // Process conditions if provided
    if (updatePaymentRuleInput.conditions) {
      paymentRule.conditions = this.processConditions(
        paymentRule.paymentType,
        updatePaymentRuleInput.conditions,
      );
    }

    return super.baseUpdate({
      id,
      data: paymentRule,
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
  ): Promise<PaymentRule[]> {
    return super.baseDeleteMany({
      ids,
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
   * Encuentra reglas de pago únicas por workerType y si es null por otherType y paymentType. Prioriza reglas con producto asociado.
   */
  async findPaymentRulesByWorkerType(
    workerType?: WorkerType,
    otherType?: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentRule[]> {
    // Primero buscamos reglas específicas para el workerType
    const rules = await this.find(
      {
        filters: [
          {
            property: 'isActive',
            operator: ConditionalOperator.EQUAL,
            value: 'true',
          },
          {
            filters: [
              {
                property: 'workerType',
                operator: ConditionalOperator.EQUAL,
                value: String(workerType),
                logicalOperator: LogicalOperator.OR,
              },
              {
                property: 'otherType',
                operator: ConditionalOperator.EQUAL,
                value: otherType,
                logicalOperator: LogicalOperator.OR,
              },
            ],
          } as ListFilter,
        ],
      },
      cu,
      scopes,
      manager,
    );

    return rules.data as Array<PaymentRule>;
  }

  /**
   * Busca reglas de pago por producto o categoría
   */
  async findPaymentRulesByProductOrCategory(
    productId?: number,
    categoryId?: number,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<PaymentRule[]> {
    const filters: ListFilter[] = [
      {
        property: 'isActive',
        operator: ConditionalOperator.EQUAL,
        value: 'true',
      },
    ];

    if (productId) {
      filters.push({
        property: 'product.id',
        operator: ConditionalOperator.EQUAL,
        value: String(productId),
        logicalOperator: LogicalOperator.AND,
      });
    }

    if (categoryId) {
      filters.push({
        property: 'category.id',
        operator: ConditionalOperator.EQUAL,
        value: String(categoryId),
        logicalOperator: LogicalOperator.AND,
      });
    }

    const rules = await this.find(
      {
        filters,
      },
      cu,
      scopes,
      manager,
    );

    return rules.data as Array<PaymentRule>;
  }
}
