import { describe, expect, it } from 'vitest';
import { MAX_MONEY_CENTS } from '@canaldigital/packages/core/money-limits';
import { formatMoney, formatMinorUnitsForInput, parseToMinorUnits } from '@/lib/money';
import {
  createProductFormSchema,
  createUpdateProductFormSchema,
} from '@/features/products/schemas/product-form.schema';

describe('monetary presentation boundary', (): void => {
  it.each([
    ['USD', '0.29', 29],
    ['USD', '1.01', 101],
    ['USD', '0.3', 30],
    ['USD', '21474836.47', MAX_MONEY_CENTS],
    ['CLP', '129', 129],
    ['CLP', '2147483647', 2147483647],
    ['PEN', '10.5', 1050],
  ])('parses %s "%s" to %i minor units exactly', (currency, text, minor): void => {
    expect(parseToMinorUnits(text, currency)).toBe(minor);
  });

  it('never accumulates float error on 0.1 and 0.2 style strings', (): void => {
    expect(parseToMinorUnits('0.1', 'USD') + parseToMinorUnits('0.2', 'USD')).toBe(30);
    expect(parseToMinorUnits('0.3', 'USD')).toBe(30);
    expect(parseToMinorUnits('1.15', 'USD')).toBe(115);
  });

  it.each([
    ['USD', ''],
    ['USD', '1.999'],
    ['USD', '1.2.3'],
    ['USD', '-1.23'],
    ['USD', '1e2'],
    ['USD', 'NaN'],
    ['USD', 'Infinity'],
    ['USD', '21474836.48'],
    ['CLP', '1.5'],
    ['CLP', '1.0'],
    ['CLP', '2147483648'],
  ])('rejects %s input "%s"', (currency, value): void => {
    expect((): number => parseToMinorUnits(value, currency)).toThrow();
  });

  it('rejects unsupported currencies', (): void => {
    expect((): number => parseToMinorUnits('1', 'KWD')).toThrow();
    expect((): string => formatMoney(1, 'KWD', 'en-US')).toThrow();
  });

  it.each([
    [29, 'EUR', '€0.29'],
    [-29, 'USD', '-$0.29'],
    [129, 'USD', '$1.29'],
    [Number.MAX_SAFE_INTEGER, 'USD', '$90,071,992,547,409.91'],
  ])('formats %i %s as %s', (minor, currency, expected): void => {
    expect(formatMoney(minor, currency, 'en-US')).toBe(expected);
  });

  it('formats zero-exponent currencies without dividing by 100', (): void => {
    expect(formatMoney(129, 'CLP', 'en-US')).toMatch(/^CLP\s129$/);
    expect(formatMoney(129, 'CLP', 'en-US')).not.toContain('1.29');
    expect(formatMoney(-5000, 'CLP', 'en-US')).toContain('5,000');
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'CLP', 'en-US')).toContain('9,007,199,254,740,991');
  });

  it('returns an em dash for missing amounts and throws for non-integers', (): void => {
    expect(formatMoney(null, 'EUR', 'en-US')).toBe('—');
    expect(formatMoney(undefined, 'CLP', 'en-US')).toBe('—');
    expect((): string => formatMoney(NaN, 'USD', 'en-US')).toThrow();
    expect((): string => formatMoney(1.5, 'USD', 'en-US')).toThrow();
  });

  it.each([
    ['USD', 3000, '30.00'],
    ['USD', 5, '0.05'],
    ['CLP', 3000, '3000'],
    ['CLP', 0, '0'],
  ])('round trips %s %i through the input string', (currency, minor, text): void => {
    expect(formatMinorUnitsForInput(minor, currency)).toBe(text);
    expect(parseToMinorUnits(text, currency)).toBe(minor);
  });

  it('returns an empty input string for missing or unpersistable amounts', (): void => {
    expect(formatMinorUnitsForInput(null, 'USD')).toBe('');
    expect(formatMinorUnitsForInput(MAX_MONEY_CENTS + 1, 'USD')).toBe('');
    expect(formatMinorUnitsForInput(-1, 'USD')).toBe('');
  });
});

describe('currency-aware product price schema', (): void => {
  it('accepts up to 2 fraction digits for USD and rejects 3', (): void => {
    const price = createProductFormSchema('USD').shape.price;
    expect(price.safeParse('21474836.47').success).toBe(true);
    expect(price.safeParse('21474836.48').success).toBe(false);
    expect(price.safeParse('1.999').success).toBe(false);
    expect(price.safeParse('40.5')).toMatchObject({ success: true, data: 4050 });
  });

  it('rejects any fraction for CLP and keeps whole amounts as-is', (): void => {
    const shape = createProductFormSchema('CLP').shape;
    expect(shape.price.safeParse('1.5').success).toBe(false);
    expect(shape.price.safeParse('1.00').success).toBe(false);
    expect(shape.cost.safeParse('4000')).toMatchObject({ success: true, data: 4000 });
    expect(shape.wholesalePrice.safeParse('')).toMatchObject({ success: true, data: null });
    expect(shape.wholesalePrice.safeParse('3500.5').success).toBe(false);
    const issue = shape.price.safeParse('1.5');
    expect(issue.success ? '' : issue.error.issues[0]?.message).toBe('moneyFormatWhole');
  });

  it('exposes the same currency rules on the update schema', (): void => {
    expect(createUpdateProductFormSchema('CLP').shape.price.safeParse('10.5').success).toBe(false);
  });
});
