import { Sale } from '../../../sales/sale/entities/sale.entity';
import { SaleDetailStatus } from '../../../sales/sale-detail/enums/sale-detail-status.enum';
import { PaymentRule } from '../../payment-rule/entities/payment-rule.entity';
import { CurrencyService } from '../../currency/services/currency.service';

/** Una línea vendida, con su precio unitario en la moneda pedida */
export interface SoldLine {
  productId?: number;
  productName?: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Líneas de la venta que cuentan para una regla:
 * - solo las vendidas (`CONFIRMED`): las devueltas o canceladas no generan
 *   comisión, así que recalcular un período tras una devolución la descuenta;
 * - solo las del producto o la categoría de la regla, si los tiene;
 * - con el precio en `currency`: el que la línea guardó para esa moneda o, si
 *   no lo tiene, su precio base convertido con la tasa de cambio. Una línea
 *   sin precio ni tasa en esa moneda se omite.
 */
export async function soldLines(
  sale: Sale,
  rule: PaymentRule,
  currency: string,
  currencyService: CurrencyService,
): Promise<SoldLine[]> {
  const lines: SoldLine[] = [];
  for (const detail of sale.details ?? []) {
    if (detail.saleDetailStatus !== SaleDetailStatus.CONFIRMED) continue;
    if (rule.product?.id && detail.product?.id !== rule.product.id) continue;
    if (
      rule.category?.id &&
      detail.product?.category?.id !== rule.category.id
    ) {
      continue;
    }

    const quantity = Number(detail.quantity) || 0;
    const unitPrice = await unitPriceIn(detail, currency, currencyService);
    if (quantity > 0 && unitPrice > 0) {
      lines.push({
        productId: detail.product?.id,
        productName: detail.product?.name,
        quantity,
        unitPrice,
      });
    }
  }
  return lines;
}

async function unitPriceIn(
  detail: NonNullable<Sale['details']>[number],
  currency: string,
  currencyService: CurrencyService,
): Promise<number> {
  const options = detail.productPaymentOptions;
  const own = options?.paymentOptions?.find((o) => o.currency === currency);
  if (own) return Number(own.unitPrice) || 0;

  const baseCurrency = options?.baseCurrency ?? detail.product?.baseCurrency;
  const basePrice = Number(options?.basePrice ?? detail.product?.basePrice);
  if (!baseCurrency || !basePrice) return 0;
  if (baseCurrency === currency) return basePrice;
  try {
    return (
      basePrice *
      (await currencyService.getExchangeRate(baseCurrency, currency))
    );
  } catch {
    return 0;
  }
}
