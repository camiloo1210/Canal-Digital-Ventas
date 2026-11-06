import {
  currencyExponent,
  decimalStringToMinor,
  minorToDecimalString,
  minorUnitsPerMajor,
} from '@canaldigital/packages/core/money-format';
import { MAX_MONEY_CENTS } from '@canaldigital/packages/core/money-limits';

/** Shown instead of a fake zero when the amount (or the currency) is unknown. */
export const MISSING_MONEY_PLACEHOLDER = '—';

/**
 * Deterministically formats minor units into a display currency string. The number of fraction
 * digits comes from the ISO 4217 exponent of `currency` (CLP 129 -> "$129", USD 129 -> "$1.29").
 * Pure BigInt arithmetic; the float is only used for the already-split whole part.
 * @returns the formatted amount, or an em dash when `minorUnits` is null/undefined.
 */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency: string,
  locale: string,
): string {
  if (minorUnits === null || minorUnits === undefined) return MISSING_MONEY_PLACEHOLDER;
  if (!Number.isSafeInteger(minorUnits)) throw new Error('Invalid monetary value');

  const exponent = currencyExponent(currency);
  const scale = minorUnitsPerMajor(currency);
  const amount = BigInt(minorUnits);
  const negative = amount < BigInt(0);
  const absolute = negative ? -amount : amount;
  const whole = absolute / scale;
  const fraction = absolute % scale;
  const signedWhole: bigint | number = negative ? (whole === BigInt(0) ? -0 : -whole) : whole;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
  if (exponent === 0) return formatter.format(signedWhole);
  const fractionText = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: exponent,
    useGrouping: false,
  }).format(fraction);
  return formatter
    .formatToParts(signedWhole)
    .map((part): string => (part.type === 'fraction' ? fractionText : part.value))
    .join('');
}

/**
 * Deterministically parses a validated decimal string into persisted minor units, honouring the
 * currency exponent (no fraction for CLP, at most 2 digits for USD). Never rounds.
 * @throws Error if value is unparseable or outside safe bounds
 */
export function parseToMinorUnits(value: string, currency: string): number {
  return decimalStringToMinor(value, currency, MAX_MONEY_CENTS);
}

/**
 * Formats minor units into an input-ready string ("30.00" USD, "3000" CLP) without symbols.
 * Returns '' for missing or unpersistable values.
 */
export function formatMinorUnitsForInput(
  minorUnits: number | null | undefined,
  currency: string,
): string {
  if (minorUnits === null || minorUnits === undefined) return '';
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0 || minorUnits > MAX_MONEY_CENTS) {
    return '';
  }
  return minorToDecimalString(minorUnits, currency);
}
