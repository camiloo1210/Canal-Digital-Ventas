import type { KiviProductPayload } from '@/kivi/application/ports/out/kivi-catalog-gateway.port';
import type { KiviSourceProduct } from '@/kivi/application/ports/out/kivi-sync-store.port';

const CURRENCY = 'USD';

/**
 * Persisted versions start at 0 and Kivi requires integers >= 1; the shift keeps order. The
 * per-product offset (set only by reconcile when Kivi was ahead) keeps later versions above it.
 */
export function kiviVersionOf(product: KiviSourceProduct): number {
  return product.version + 1 + (product.kiviVersionOffset ?? 0);
}

function toDecimal(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function toKiviProductPayload(product: KiviSourceProduct): KiviProductPayload {
  const available = product.status === 'active' || product.status === 'out_of_stock';
  return {
    version: kiviVersionOf(product),
    name: product.name,
    price: toDecimal(product.priceCents),
    currency: CURRENCY,
    description: product.description,
    is_available: available,
    is_orderable: product.status === 'active' && product.stock > 0,
  };
}
