import { MAX_MONEY_CENTS } from '@/shared/domain/money-limits';

/**
 * ISO 4217 minor-unit exponents for every currency the platform supports. This is the single
 * source of truth: formatting, parsing, gateway payloads and emails must go through it instead of
 * assuming 100 minor units per major unit.
 *
 * COP follows ISO 4217 (2). Changing an exponent reinterprets every stored amount of that
 * currency, so it requires a data migration.
 */
export const CURRENCY_EXPONENTS = {
  USD: 2,
  EUR: 2,
  COP: 2,
  MXN: 2,
  ARS: 2,
  BRL: 2,
  CLP: 0,
  PEN: 2,
} as const;

export type SupportedCurrencyCode = keyof typeof CURRENCY_EXPONENTS;

export function isSupportedCurrencyCode(code: unknown): code is SupportedCurrencyCode {
  return typeof code === 'string' && Object.hasOwn(CURRENCY_EXPONENTS, code);
}

/** Number of minor-unit decimals of a supported currency. Throws for unsupported codes. */
export function currencyExponent(code: string): number {
  if (!isSupportedCurrencyCode(code)) throw new Error(`Unsupported currency: ${code}`);
  return CURRENCY_EXPONENTS[code];
}

/** Minor units per major unit as an exact integer (100 for USD, 1 for CLP). */
export function minorUnitsPerMajor(code: string): bigint {
  return BigInt(10) ** BigInt(currencyExponent(code));
}

/**
 * Exact decimal string of an integer amount of minor units ("5000" CLP, "50.00" USD).
 * Pure BigInt arithmetic: no float is ever involved.
 */
export function minorToDecimalString(minorUnits: number, code: string): string {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0)
    throw new Error('Invalid monetary value');
  const exponent = currencyExponent(code);
  const scale = minorUnitsPerMajor(code);
  const amount = BigInt(minorUnits);
  const whole = (amount / scale).toString();
  return exponent === 0 ? whole : `${whole}.${(amount % scale).toString().padStart(exponent, '0')}`;
}

/**
 * Exact minor units of a plain decimal string. Accepts at most `exponent` fraction digits
 * (none for CLP), never rounds, and rejects anything above `max`.
 */
export function decimalStringToMinor(
  value: string,
  code: string,
  max: number = MAX_MONEY_CENTS,
): number {
  if (typeof value !== 'string') throw new Error('Invalid monetary value');
  const exponent = currencyExponent(code);
  const pattern = exponent === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${exponent}})?$`);
  const text = value.trim();
  if (!pattern.test(text)) throw new Error('Invalid monetary value');
  const [whole, fraction = ''] = text.split('.');
  const minor =
    BigInt(whole) * minorUnitsPerMajor(code) + BigInt(fraction.padEnd(exponent, '0') || '0');
  if (minor > BigInt(max)) throw new Error('Value exceeds safe money bounds');
  return Number(minor);
}
