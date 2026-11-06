import { currencyExponent } from '@/shared/domain/money-format';

/**
 * Lemon Squeezy `custom_price` (and order `total`) is an integer in the smallest unit of the
 * checkout currency ("cents"). Our stored amounts are already integer minor units of the same
 * currency (exponent 0 for CLP, 2 for USD), so the value passes through unchanged. This helper
 * makes that contract explicit: it never scales, and rejects unsupported currencies or amounts
 * that are not positive safe integers.
 */
export function toProviderMinorUnits(amountMinor: number, currency: string): number {
  currencyExponent(currency);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Provider amount must be a positive safe integer of minor units.');
  }
  return amountMinor;
}
