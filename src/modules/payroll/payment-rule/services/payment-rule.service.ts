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
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
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
    paymentRule.name = createPaymentRuleInput.name;
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

    return super.baseCreate({
      data: paymentRule,
      uniqueFields: ['name'],
      cu,
      scopes,
      manager,
    });
  }

  private processConditions(
    paymentType: PaymentType,
    conditions: ConditionsInput,
  ): Conditions {
    const result: Conditions = {};

    switch (paymentType) {
      case PaymentType.PRICE_RANGE:
        if (!conditions.priceRanges?.length) {
          throw new Error('Price ranges are required for PRICE_RANGE type');
        }
        result.priceRanges = conditions.priceRanges.map((range) => ({
          min: range.min,
          max: range.max ?? null,
          currency: range.currency,
          amount: range.amount,
          percentage: range.percentage,
        }));
        break;

      case PaymentType.SALE_QUANTITY:
        if (!conditions.saleQuantity?.length) {
          throw new Error(
            'Sale quantity conditions are required for SALE_QUANTITY type',
          );
        }
        result.saleQuantity = conditions.saleQuantity.map((sq) => ({
          minProducts: sq.minProducts,
          ratePerProduct: sq.ratePerProduct,
          percentagePerProduct: sq.percentagePerProduct,
        }));
        break;

      case PaymentType.FIXED_AMOUNT:
        if (!conditions.fixedAmount) {
          throw new Error(
            'Fixed amount condition is required for FIXED_AMOUNT type',
          );
        }
        result.fixedAmount = {
          amount: conditions.fixedAmount.amount,
        };
        break;

      case PaymentType.PERCENTAGE:
        if (!conditions.percentage) {
          throw new Error(
            'Percentage condition is required for PERCENTAGE type',
          );
        }
        result.percentage = {
          percentage: conditions.percentage.percentage,
        };
        break;

      default:
        throw new Error(`Unsupported payment type: ${paymentType as string}`);
    }

    return result;
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    return await super.baseFind({
      options,
      relationsToLoad: ['product', 'category'],
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
      relationsToLoad: { product: true, category: true },
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
    const paymentRule = await super.baseFindOne({ id, cu, scopes, manager });
    if (!paymentRule) {
      throw new NotFoundError('Payment rule not found');
    }

    // Update fields if provided
    if (updatePaymentRuleInput.paymentType !== undefined) {
      paymentRule.paymentType = updatePaymentRuleInput.paymentType;
    }
    if (updatePaymentRuleInput.name !== undefined) {
      paymentRule.name = updatePaymentRuleInput.name;
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
        paymentRule.product = undefined;
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
        paymentRule.category = undefined;
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
    // Check if any rules are assigned to workers before deletion
    const assignedRules = await this.checkAssignedRules(ids);
    if (assignedRules.length > 0) {
      throw new Error(
        `Cannot delete payment rules assigned to workers: ${assignedRules.join(', ')}`,
      );
    }

    return super.baseDeleteMany({
      ids,
      cu,
      scopes,
      manager,
      softRemove: true,
    });
  }

  private async checkAssignedRules(ids: number[]): Promise<number[]> {
    const result = await this.paymentRuleRepository
      .createQueryBuilder('rule')
      .select('rule.id')
      .innerJoin('py_workers', 'worker', 'worker.paymentRuleId = rule.id')
      .where('rule.id IN (:...ids)', { ids })
      .getRawMany();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return result.map((r) => r.rule_id);
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
