import { describe, expect, it } from 'vitest';
import { normalizeCountryCode } from '@/shipment-creation/domain/country-code';

describe('normalizeCountryCode', (): void => {
  it.each([
    ['Colombia', 'CO'],
    ['colombia ', 'CO'],
    ['co', 'CO'],
    ['CO', 'CO'],
    ['Perú', 'PE'],
    ['Peru', 'PE'],
    ['Estados Unidos', 'US'],
    ['United States', 'US'],
    ['  méxico ', 'MX'],
  ])('maps %j to %s', (raw: string, code: string): void => {
    expect(normalizeCountryCode(raw)).toBe(code);
  });

  it.each(['Atlantis', '', '   ', 'XQ', 'C0'])('returns null for %j', (raw: string): void => {
    expect(normalizeCountryCode(raw)).toBeNull();
  });
});
