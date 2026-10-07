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
import { ConflictError } from '../../../../core/errors/appErrors/ConflictError.error';

/** Moneda de referencia: las tasas de las demás dicen cuántos CUP valen */
export const BASE_CURRENCY = 'CUP';

/**
 * Monedas. Son comunes a todas las empresas y se identifican por su código
 * (productos, precios y pagos guardan el código), así que este no cambia.
 */
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
    const code = createCurrencyInput.code.trim().toUpperCase();
    const existing = await this.currencyRepository.findOne({
      where: { code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictError(`Ya existe la moneda ${code}`);
    }
    const currency = {
      ...createCurrencyInput,
      code,
      name: createCurrencyInput.name.trim(),
      symbol: createCurrencyInput.symbol.trim(),
      isActive: createCurrencyInput.isActive ?? true,
    } as Currency;

    return super.baseCreate({ data: currency, cu, scopes, manager });
  }

  async find(
    options?: ListOptions,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<ListSummary> {
    const effectiveScopes =
      scopes ??
      Object.values(ScopedAccessEnum).filter(
        (e) => e != ScopedAccessEnum.PERSONAL,
      );

    return await super.baseFind({
      options,
      cu,
      scopes: effectiveScopes,
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
      id,
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

  /** Nombre, símbolo y tasa. El código no cambia y CUP vale siempre 1 */
  async update(
    id: number,
    updateCurrencyInput: UpdateCurrencyInput,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Currency> {
    const current = await this.findOne(id, cu, scopes, manager);
    const { code, name, symbol, exchangeRateToCUP, isActive, metadata } =
      updateCurrencyInput;
    if (code !== undefined && code.trim().toUpperCase() !== current.code) {
      throw new BadRequestError(
        'El código de una moneda no se cambia: productos y pagos lo guardan',
      );
    }
    if (current.code === BASE_CURRENCY) {
      if (exchangeRateToCUP !== undefined && exchangeRateToCUP !== 1) {
        throw new BadRequestError(
          'CUP es la moneda de referencia: su tasa es 1',
        );
      }
      if (isActive === false) {
        throw new BadRequestError(
          'CUP es la moneda de referencia: no se desactiva',
        );
      }
    }
    if (isActive === false && current.isActive) {
      await this.checkNotInUse(current.code, manager);
    }

    const updated = await super.baseUpdate({
      id,
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(symbol !== undefined && { symbol: symbol.trim() }),
        ...(exchangeRateToCUP !== undefined && { exchangeRateToCUP }),
        ...(isActive !== undefined && { isActive }),
        ...(metadata !== undefined && { metadata }),
      },
      cu,
      scopes,
      manager,
    });
    this.exchangeRateCache.clear();
    return updated;
  }

  async updateStatus(
    code: string,
    isActive: boolean,
    cu?: JWTPayload,
    scopes?: ScopedAccessEnum[],
    manager?: EntityManager,
  ): Promise<Currency> {
    const currency = await this.findByCode(code, cu, scopes, manager);
    if (!currency) {
      throw new NotFoundError(`No existe la moneda ${code}`);
    }
    return this.update(
      currency.id as number,
      { id: currency.id as number, isActive },
      cu,
      scopes,
      manager,
    );
  }

  /** Una moneda que aceptan productos no se desactiva: dejarían de venderse */
  private async checkNotInUse(code: string, manager?: EntityManager) {
    const [{ count }] = await (
      manager ?? this.currencyRepository.manager
    ).query<Array<{ count: string }>>(
      `SELECT count(*) AS count FROM in_products
       WHERE "deletedAt" IS NULL
         AND ("baseCurrency" = $1 OR "costCurrency" = $1
              OR "pricingConfig"->'acceptedCurrencies' ? $1)`,
      [code],
    );
    if (Number(count) > 0) {
      throw new BadRequestError(
        `${count} producto(s) usan ${code}: quítala de ellos antes de desactivarla`,
      );
    }
  }

  async getExchangeRate(
    fromCurrencyCode: string,
    toCurrencyCode: string,
    manager?: EntityManager,
  ): Promise<number> {
    if (fromCurrencyCode === toCurrencyCode) {
      return 1;
    }

    const cacheKey = `${fromCurrencyCode}_${toCurrencyCode}`;
    const cachedRate = this.exchangeRateCache.get(cacheKey);
    if (cachedRate) {
      return cachedRate;
    }

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
      throw new NotFoundError(
        `No existe la moneda ${!fromCurrency ? fromCurrencyCode : toCurrencyCode}`,
      );
    }
    if (!fromCurrency.isActive || !toCurrency.isActive) {
      throw new BadRequestError(
        `La moneda ${!fromCurrency.isActive ? fromCurrencyCode : toCurrencyCode} está desactivada`,
      );
    }

    // Ambas tasas están en CUP: de origen a CUP y de CUP a destino
    const rate =
      Number(fromCurrency.exchangeRateToCUP) /
      Number(toCurrency.exchangeRateToCUP);

    this.exchangeRateCache.set(cacheKey, rate);
    setTimeout(() => this.exchangeRateCache.delete(cacheKey), this.cacheTTL);

    return rate;
  }
}
