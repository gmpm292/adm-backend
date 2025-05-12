import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateCurrencyInput } from '../dto/create-currency.input';
import { UpdateCurrencyInput } from '../dto/update-currency.input';
import { BaseService } from '../../../../core/services/base.service';
import { Currency } from '../entities/currency.entity';
import {
  ListOptions,
  ListSummary,
} from '../../../../core/graphql/remote-operations';
import { JWTPayload } from '../../../auth/dto/jwt-payload.dto';
import { ScopedAccessEnum } from '../../../../core/enums/scoped-access.enum';
import { ScopedAccessService } from '../../../scoped-access/services/scoped-access.service';

@Injectable()
export class CurrencyService extends BaseService<Currency> {
  constructor(
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
    protected scopedAccessService: ScopedAccessService,
  ) {
    super(currencyRepository);
  }

  async create(
    createCurrencyInput: CreateCurrencyInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Currency> {
    const currency: Currency = {
      ...createCurrencyInput,
      isActive: createCurrencyInput.isActive ?? true,
    } as Currency;

    return super.baseCreate({
      data: currency,
      uniqueFields: ['code'],
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
  ): Promise<Currency> {
    return super.baseFindOne({
      id, // Usamos el código como ID
      cu,
      scopes,
      manager,
    });
  }

  findByCode(
    code: string,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ) {
    return this.baseFindOneByFilters({
      filters: { code },
      cu,
      scopes,
      manager,
    });
  }

  async update(
    id: number,
    updateCurrencyInput: UpdateCurrencyInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Currency> {
    return super.baseUpdate({
      id,
      data: { ...updateCurrencyInput },
      cu,
      scopes,
      manager,
    });
  }

  async updateStatus(
    id: number,
    isActive: boolean,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Currency> {
    return super.baseUpdate({
      id,
      data: { id, isActive },
      cu,
      scopes,
      manager,
    });
  }
}
