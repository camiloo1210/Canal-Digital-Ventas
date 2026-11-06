import { describe, it, expect } from 'vitest';
import { Currency } from '@/shared/domain/enums/currency.enum';
import {
  CURRENCY_EXPONENTS,
  currencyExponent,
  decimalStringToMinor,
  minorToDecimalString,
} from '@/shared/domain/money-format';

describe('currency exponents', (): void => {
  it('covers every supported Currency exactly', (): void => {
    expect(Object.keys(CURRENCY_EXPONENTS).sort()).toEqual(Object.values(Currency).sort());
  });
  it('rejects unsupported currencies instead of assuming 2 decimals', (): void => {
    expect((): number => currencyExponent('XXX')).toThrow('Unsupported currency');
    expect((): number => currencyExponent('toString')).toThrow('Unsupported currency');
  });
});

describe.each([
  ['USD', 2, 5000, '50.00'],
  ['CLP', 0, 5000, '5000'],
  ['COP', 2, 129900, '1299.00'],
  ['USD', 2, 5, '0.05'],
  ['CLP', 0, 0, '0'],
])('%s (%i decimals)', (code: string, _exp: number, minor: number, text: string): void => {
  it(`round-trips ${minor} <-> ${text}`, (): void => {
    expect(minorToDecimalString(minor, code)).toBe(text);
    expect(decimalStringToMinor(text, code)).toBe(minor);
  });
});

describe('decimalStringToMinor', (): void => {
  it('honours the currency exponent and never rounds', (): void => {
    expect(decimalStringToMinor('12', 'USD')).toBe(1200);
    expect(decimalStringToMinor('12.5', 'USD')).toBe(1250);
    expect(decimalStringToMinor('1290', 'CLP')).toBe(1290);
    for (const bad of ['12.345', '0.1e1', '-1', '', '1,5', ' ']) {
      expect((): number => decimalStringToMinor(bad, 'USD')).toThrow('Invalid monetary value');
    }
    expect((): number => decimalStringToMinor('12.5', 'CLP')).toThrow('Invalid monetary value');
  });
  it('is exact where floats are not', (): void => {
    expect(decimalStringToMinor('0.29', 'USD')).toBe(29);
    expect(decimalStringToMinor('1.15', 'USD')).toBe(115);
    expect(decimalStringToMinor('21474836.47', 'USD')).toBe(2147483647);
  });
  it('rejects values above the maximum', (): void => {
    expect((): number => decimalStringToMinor('21474836.48', 'USD')).toThrow('exceeds');
    expect((): number => decimalStringToMinor('99999999999999999999', 'CLP')).toThrow('exceeds');
  });
});
