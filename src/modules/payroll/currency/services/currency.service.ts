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
import { NotFoundError } from '../../../../core/errors/appErrors/NotFoundError.error';
import { BadRequestError } from '../../../../core/errors/appErrors/BadRequestError.error';

@Injectable()
export class CurrencyService extends BaseService<Currency> {
  private exchangeRateCache = new Map<string, number>();
  private cacheTTL = 1000 * 60 * 5; // 5 minutos

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
    scopes = [];
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

  async getExchangeRate(
    fromCurrencyCode: string,
    toCurrencyCode: string,
    manager?: EntityManager,
  ): Promise<number> {
    const cacheKey = `${fromCurrencyCode}_${toCurrencyCode}`;
    const cachedRate = this.exchangeRateCache.get(cacheKey);

    if (cachedRate) {
      return cachedRate;
    }

    if (fromCurrencyCode === toCurrencyCode) {
      return 1; // Misma moneda, tasa 1:1
    }

    // Obtener ambas monedas
    const fromCurrency = await this.findByCode(
      fromCurrencyCode,
      undefined,
      undefined,
      manager,
    );
    const toCurrency = await this.findByCode(
      toCurrencyCode,
      undefined,
      undefined,
      manager,
    );

    if (!fromCurrency || !toCurrency) {
      throw new NotFoundError('One or both currencies were not found');
    }

    if (!fromCurrency.isActive || !toCurrency.isActive) {
      throw new BadRequestError('One or both currencies were not active');
    }

    const rate =
      fromCurrencyCode === toCurrencyCode // Misma moneda, tasa 1:1
        ? 1
        : fromCurrencyCode === 'CUP' // Si alguna moneda es CUP, podemos simplificar el cálculo
          ? 1 / toCurrency.exchangeRateToCUP
          : toCurrencyCode === 'CUP' // Si alguna moneda es CUP, podemos simplificar el cálculo
            ? fromCurrency.exchangeRateToCUP
            : fromCurrency.exchangeRateToCUP / toCurrency.exchangeRateToCUP; // Para conversiones entre dos monedas que no son CUP: Primero convertimos de la moneda origen a CUP, luego de CUP a la moneda destino

    // Almacenar en caché
    this.exchangeRateCache.set(cacheKey, rate);
    setTimeout(() => this.exchangeRateCache.delete(cacheKey), this.cacheTTL);

    return rate;
  }
}
