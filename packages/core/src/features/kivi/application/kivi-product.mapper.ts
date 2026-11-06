import { parseCurrency } from '@/shared/domain/enums/currency.enum';
import type { KiviProductPayload } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviSourceProduct } from '@/kivi/application/ports/out/kivi-sync-store.port';
import { MAX_MONEY_CENTS } from '@/shared/domain/money-limits';
import { minorToDecimalString } from '@/shared/domain/money-format';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';

/**
 * Persisted versions start at 0 and Kivi requires integers >= 1; the shift keeps order. The
 * per-product offset (set only by reconcile when Kivi was ahead) keeps later versions above it.
 */
export function kiviVersionOf(product: KiviSourceProduct): number {
  return product.version + 1 + (product.kiviVersionOffset ?? 0);
}

export function centsToDecimalString(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MONEY_CENTS) {
    throw new InvalidMoneyException('Invalid minor units for external monetary representation.');
  }
  return minorToDecimalString(amount, currency);
}

export function toKiviProductPayload(product: KiviSourceProduct): KiviProductPayload {
  const hasWholesale = product.wholesalePriceCents > 0 && product.wholesaleMinQuantity >= 1;
  const available = product.status === 'active' || product.status === 'out_of_stock';
  return {
    version: kiviVersionOf(product),
    name: product.name,
    price: centsToDecimalString(product.priceCents, product.currency),
    wholesale_price: hasWholesale
      ? centsToDecimalString(product.wholesalePriceCents, product.currency)
      : null,
    wholesale_min_quantity: hasWholesale ? product.wholesaleMinQuantity : null,
    currency: parseCurrency(product.currency),
    description: product.description,
    is_available: available,
    is_orderable: product.status === 'active' && product.stock > 0,
    image_urls: (product.imageUrls ?? []).slice(0, 5),
  };
}
