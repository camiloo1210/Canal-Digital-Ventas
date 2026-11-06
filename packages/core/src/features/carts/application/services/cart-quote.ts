export { MAX_LINE_QUANTITY } from '@/carts/domain/policies/buyer-cart-limits';
import { selectUnitPriceCents } from '@/shared/domain/unit-price.policy';
import { MAX_MONEY_CENTS } from '@/shared/domain/money-limits';
import { isSupportedCurrencyCode } from '@/shared/domain/money-format';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';

/** Catalog pricing snapshot. Checkout revalidates these terms on the server. */
export interface CartPricing {
  retailPriceCents: number;
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number | null;
  currency: string;
}

export interface CartQuoteLine extends CartPricing {
  quantity: number;
}

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MONEY_CENTS) {
    throw new InvalidMoneyException('Invalid cart price.');
  }
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvalidMoneyException('Cart quote exceeds safe integer bounds.');
  }
  return Number(value);
}

/** Same wholesale threshold policy used by order creation; arithmetic uses exact minor units. */
export function quoteCartLine(line: CartQuoteLine): { unitPriceCents: number; totalCents: number } {
  assertAmount(line.retailPriceCents);
  if (line.wholesalePriceCents !== null) assertAmount(line.wholesalePriceCents);
  if (
    !isSupportedCurrencyCode(line.currency) ||
    !Number.isSafeInteger(line.quantity) ||
    line.quantity < 1 ||
    (line.wholesaleMinQuantity !== null &&
      (!Number.isSafeInteger(line.wholesaleMinQuantity) || line.wholesaleMinQuantity < 0))
  ) {
    throw new InvalidMoneyException('Invalid cart currency or quantity.');
  }
  const unitPriceCents = selectUnitPriceCents(line, line.quantity);
  return {
    unitPriceCents,
    totalCents: toSafeNumber(BigInt(unitPriceCents) * BigInt(line.quantity)),
  };
}

/** Informational totals may exceed the order limit, but never lose integer precision. */
export function quoteCartSubtotal(lines: readonly CartQuoteLine[]): number {
  let total = BigInt(0);
  for (const line of lines) {
    if (line.currency !== lines[0].currency)
      throw new InvalidMoneyException('Cannot combine cart currencies.');
    total += BigInt(quoteCartLine(line).totalCents);
  }
  return toSafeNumber(total);
}

/** Unsupported persisted orders are displayed with a blocking message before submission. */
export function isCartQuoteWithinLimit(lines: readonly CartQuoteLine[]): boolean {
  try {
    return quoteCartSubtotal(lines) <= MAX_MONEY_CENTS;
  } catch {
    return false;
  }
}
