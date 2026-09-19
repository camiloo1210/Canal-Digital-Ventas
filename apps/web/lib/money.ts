/**
 * Deterministically formats minor units into a display currency string.
 * @param minorUnits The integer value in minor units (e.g. cents)
 * @param currency The ISO 4217 currency code. (e.g., USD)
 * @returns Formatted currency string
 */
export function formatMoney(minorUnits: number | null | undefined, currency = 'USD'): string {
  if (
    minorUnits === null ||
    minorUnits === undefined ||
    !Number.isFinite(minorUnits) ||
    Number.isNaN(minorUnits)
  ) {
    return '$0.00';
  }

  const decimalValue = minorUnits / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(decimalValue);
}

/**
 * Deterministically parses a valid decimal string or number into minor units (integers).
 * Pre-emptively rejects unaccepted formatting or extreme values.
 *
 * @param value The raw input (string or number from FormData/Zod)
 * @returns integer denoting minor units
 * @throws Error if value is unparseable or outside safe bounds
 */
export function parseToMinorUnits(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = typeof value === 'string' ? parseFloat(value) : value;

  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid monetary value');
  }

  // Prevent floating point inaccuracies (e.g. 12.55 * 100 = 1254.999...)
  const minorUnits = Math.round(parsed * 100);

  if (minorUnits > Number.MAX_SAFE_INTEGER || minorUnits < 0) {
    throw new Error('Value exceeds safe money bounds');
  }

  return minorUnits;
}
