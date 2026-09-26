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
export function parseToMinorUnits(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Invalid monetary value');
    }
    const minorUnits = Math.round(value * 100);
    if (minorUnits > Number.MAX_SAFE_INTEGER || minorUnits < 0) {
      throw new Error('Value exceeds safe money bounds');
    }
    return minorUnits;
  }

  // Precondition: String must be syntactically validated (e.g., by Zod regex /^\d+(\.\d{1,2})?$/)
  const sanitized = value.trim();
  if (sanitized === '') {
    throw new Error('Invalid monetary value: empty string');
  }

  const parts = sanitized.split('.');
  const wholeStr = parts[0] || '0';
  const fractionStr = parts[1] || '00';
  
  const paddedFraction = fractionStr.padEnd(2, '0').substring(0, 2);

  try {
    const minorUnitsBig = BigInt(wholeStr) * BigInt(100) + BigInt(paddedFraction);
    
    if (minorUnitsBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Value exceeds safe money bounds');
    }
    
    return Number(minorUnitsBig);
  } catch (err) {
    if (err instanceof Error && err.message === 'Value exceeds safe money bounds') {
      throw err;
    }
    throw new Error('Invalid monetary value');
  }
}

/**
 * Formats minor units into an input-ready string (e.g. "30.00" without currency symbols)
 * Strict integer arithmetic to avoid floating point issues.
 */
export function formatMinorUnitsForInput(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) {
    return '';
  }
  if (!Number.isInteger(minorUnits) || minorUnits < 0) {
    return '';
  }
  
  const wholeStr = Math.floor(minorUnits / 100).toString();
  const fractionStr = (minorUnits % 100).toString().padStart(2, '0');
  
  return `${wholeStr}.${fractionStr}`;
}
