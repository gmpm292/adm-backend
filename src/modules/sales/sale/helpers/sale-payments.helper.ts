import { ProductPaymentOptions } from '../../../inventory/product/types/product-payment-options.type';

export type SalePaymentInput = { amount: number; currency: string };

export type SaleCurrencyTotal = { currency: string; total: number };

export type SalePaymentEvaluation = {
  valid: boolean;
  message?: string;
  /** Moneda en la que se expresan los importes de abajo. */
  currency: string;
  /** Precio de la venta. */
  totalInBaseCurrency: number;
  paidInBaseCurrency: number;
  pendingInBaseCurrency: number;
  changeInBaseCurrency: number;
  /** Precio de la venta en cada moneda en que puede cobrarse completa. */
  totals: SaleCurrencyTotal[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Precio total por moneda. Solo cuentan las monedas que aceptan todas las
 * líneas: en las demás la venta no puede cobrarse completa.
 */
export function totalsByCurrency(
  lines: Array<ProductPaymentOptions | undefined | null>,
): SaleCurrencyTotal[] {
  if (lines.length === 0) return [];

  const totals = new Map<string, { total: number; lines: number }>();
  for (const line of lines) {
    const seen = new Set<string>();
    for (const option of line?.paymentOptions ?? []) {
      if (seen.has(option.currency)) continue;
      seen.add(option.currency);
      const current = totals.get(option.currency) ?? { total: 0, lines: 0 };
      current.total += Number(option.total) || 0;
      current.lines += 1;
      totals.set(option.currency, current);
    }
  }

  return [...totals.entries()]
    .filter(([, value]) => value.lines === lines.length)
    .map(([currency, value]) => ({ currency, total: round2(value.total) }));
}

/**
 * Precio de una línea en la moneda de su venta. Si la línea no se vende en
 * esa moneda se informa en la suya.
 */
export function lineAmounts(
  line: ProductPaymentOptions | undefined | null,
  currency?: string | null,
): {
  currency: string | null;
  unitPrice: number | null;
  subtotal: number | null;
} {
  const options = line?.paymentOptions ?? [];
  const option =
    options.find((o) => o.currency === currency) ??
    options.find((o) => o.currency === line?.baseCurrency) ??
    options[0];
  if (!option) {
    // Líneas antiguas: solo guardaron el precio base.
    if (line?.basePrice == null || !line.baseCurrency) {
      return { currency: null, unitPrice: null, subtotal: null };
    }
    return {
      currency: line.baseCurrency,
      unitPrice: Number(line.basePrice),
      subtotal: round2(Number(line.basePrice) * Number(line.quantity ?? 0)),
    };
  }
  return {
    currency: option.currency,
    unitPrice: Number(option.unitPrice),
    subtotal: round2(Number(option.total)),
  };
}

/** Texto de un error de negocio (`AppError` guarda `{ code, message }`). */
export function errorText(error: unknown): string {
  const raw = (error as Error)?.message ?? String(error);
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    return parsed?.message ?? raw;
  } catch {
    return raw;
  }
}

/** Moneda en la que se informa la venta cuando no se pide una concreta. */
export function defaultSaleCurrency(
  lines: Array<ProductPaymentOptions | undefined | null>,
  totals: SaleCurrencyTotal[],
): string | undefined {
  const accepted = totals.map((t) => t.currency);
  const base = lines.find(
    (line) => line && accepted.includes(line.baseCurrency),
  )?.baseCurrency;
  return base ?? accepted[0];
}

/**
 * Compara lo cobrado con el precio de la venta. Cada moneda tiene su propio
 * precio (puede ser fijo, no una conversión), así que un pago cubre la
 * fracción `importe / precio en su moneda` y las fracciones se suman; con
 * eso se puede cobrar una parte en una moneda y el resto en otra.
 */
export function evaluatePayments(
  totals: SaleCurrencyTotal[],
  payments: SalePaymentInput[],
  saleCurrency?: string,
): SalePaymentEvaluation {
  const byCurrency = new Map(totals.map((t) => [t.currency, t.total]));
  const currency =
    saleCurrency && byCurrency.has(saleCurrency)
      ? saleCurrency
      : totals[0]?.currency;

  const result = (
    partial: Partial<SalePaymentEvaluation>,
  ): SalePaymentEvaluation => ({
    valid: false,
    currency: currency ?? saleCurrency ?? '',
    totalInBaseCurrency: currency ? (byCurrency.get(currency) as number) : 0,
    paidInBaseCurrency: 0,
    pendingInBaseCurrency: currency ? (byCurrency.get(currency) as number) : 0,
    changeInBaseCurrency: 0,
    totals,
    ...partial,
  });

  if (!currency) {
    return result({
      message: 'Los productos de la venta no comparten ninguna moneda de cobro',
    });
  }

  if (saleCurrency && !byCurrency.has(saleCurrency)) {
    return result({
      message: `La venta no puede cobrarse en ${saleCurrency}: no todos los productos aceptan esa moneda`,
    });
  }

  const rejected = [
    ...new Set(
      payments
        .filter((p) => !byCurrency.has(p.currency))
        .map((p) => p.currency),
    ),
  ];
  if (rejected.length > 0) {
    return result({
      message: `No todos los productos de la venta aceptan pagos en ${rejected.join(', ')}`,
    });
  }

  const total = byCurrency.get(currency) as number;
  let covered = 0;
  for (const payment of payments) {
    const totalInCurrency = byCurrency.get(payment.currency) as number;
    if (totalInCurrency > 0) covered += payment.amount / totalInCurrency;
  }

  const paid = total > 0 ? round2(covered * total) : 0;
  const pending = round2(Math.max(total - paid, 0));
  const change = round2(Math.max(paid - total, 0));

  if (pending > 0) {
    return result({
      paidInBaseCurrency: paid,
      pendingInBaseCurrency: pending,
      message: `Faltan ${pending.toFixed(2)} ${currency} por cobrar`,
    });
  }

  return result({
    valid: true,
    paidInBaseCurrency: paid,
    pendingInBaseCurrency: 0,
    changeInBaseCurrency: change,
  });
}
