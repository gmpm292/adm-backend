import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePaymentRuleInput } from '../dto/create-payment-rule.input';
import { UpdatePaymentRuleInput } from '../dto/update-payment-rule.input';
import { BaseService } from '../../../../core/services/base.service';
import { PaymentRule } from '../entities/payment-rule.entity';
import {
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

@Injectable()
export class PaymentRuleService extends BaseService<PaymentRule> {
  constructor(
    @InjectRepository(PaymentRule)
    private paymentRuleRepository: Repository<PaymentRule>,
    protected scopedAccessService: ScopedAccessService,
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
  ) {
    const result: Conditions = {
      paymentCurrency: conditions.paymentCurrency,
    };

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
          scope: range.scope,
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
          scope: sq.scope,
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
          scope: conditions.fixedAmount.scope,
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
          scope: conditions.percentage.scope,
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
}
