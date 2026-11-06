import { describe, expect, it } from 'vitest';
import { toProviderMinorUnits } from '@/payments/infrastructure/lemon-squeezy-amount';

describe('toProviderMinorUnits', (): void => {
  it('passes CLP (exponent 0) and USD (exponent 2) minor units through unscaled', (): void => {
    expect(toProviderMinorUnits(5000, 'CLP')).toBe(5000);
    expect(toProviderMinorUnits(5000, 'USD')).toBe(5000);
  });
  it('rejects unsupported currencies and non-integer or non-positive amounts', (): void => {
    expect((): number => toProviderMinorUnits(5000, 'XXX')).toThrow();
    expect((): number => toProviderMinorUnits(1.5, 'USD')).toThrow();
    expect((): number => toProviderMinorUnits(0, 'USD')).toThrow();
  });
});
