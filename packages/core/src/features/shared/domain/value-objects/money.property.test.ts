import { describe, it } from 'vitest';
import fc from 'fast-check';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import { RoundingMode } from '@/shared/domain/rounding-mode';

const SEED: number = Number(process.env.FC_SEED ?? 20261108);
const CONFIG: fc.Parameters<unknown> = { numRuns: 500, seed: SEED };

const currencyArb: fc.Arbitrary<Currency> = fc.constantFrom(...Object.values(Currency));
const amountArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: MAX_MONEY_CENTS });
const THIRD: number = Math.floor(MAX_MONEY_CENTS / 3);
const smallArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: THIRD });

function isInvalidMoney(work: () => unknown): boolean {
  try {
    work();
    return false;
  } catch (error: unknown) {
    return error instanceof InvalidMoneyException;
  }
}

describe('Money property tests', (): void => {
  it('property: addition is commutative within bounds', (): void => {
    fc.assert(
      fc.property(smallArb, smallArb, currencyArb, (a: number, b: number, c: Currency): boolean => {
        const x = Money.from(a, c);
        const y = Money.from(b, c);
        return x.add(y).equals(y.add(x));
      }),
      CONFIG,
    );
  });

  it('property: addition is associative within bounds', (): void => {
    fc.assert(
      fc.property(
        smallArb,
        smallArb,
        smallArb,
        currencyArb,
        (a: number, b: number, d: number, c: Currency): boolean => {
          const x = Money.from(a, c);
          const y = Money.from(b, c);
          const z = Money.from(d, c);
          return x
            .add(y)
            .add(z)
            .equals(x.add(y.add(z)));
        },
      ),
      CONFIG,
    );
  });

  it('property: a.add(b).subtract(b) equals a and the sum is exact', (): void => {
    fc.assert(
      fc.property(smallArb, smallArb, currencyArb, (a: number, b: number, c: Currency): boolean => {
        const x = Money.from(a, c);
        const y = Money.from(b, c);
        const sum = x.add(y);
        return sum.getValue() === a + b && sum.subtract(y).equals(x);
      }),
      CONFIG,
    );
  });

  it('property: adding or subtracting different currencies always throws', (): void => {
    fc.assert(
      fc.property(
        amountArb,
        amountArb,
        currencyArb,
        currencyArb,
        (a: number, b: number, c1: Currency, c2: Currency): boolean => {
          fc.pre(c1 !== c2);
          const x = Money.from(a, c1);
          const y = Money.from(b, c2);
          return (
            isInvalidMoney((): Money => x.add(y)) && isInvalidMoney((): Money => x.subtract(y))
          );
        },
      ),
      CONFIG,
    );
  });

  it('property: results are never NaN, negative, unsafe or above the limit; overflow throws', (): void => {
    fc.assert(
      fc.property(
        amountArb,
        amountArb,
        currencyArb,
        (a: number, b: number, c: Currency): boolean => {
          const x = Money.from(a, c);
          const y = Money.from(b, c);
          const exact = BigInt(a) + BigInt(b);
          if (exact > BigInt(MAX_MONEY_CENTS)) {
            return isInvalidMoney((): Money => x.add(y));
          }
          const v = x.add(y).getValue();
          return Number.isSafeInteger(v) && v >= 0 && v <= MAX_MONEY_CENTS && v === a + b;
        },
      ),
      CONFIG,
    );
  });

  it('property: subtracting a larger amount throws, never going negative', (): void => {
    fc.assert(
      fc.property(
        amountArb,
        amountArb,
        currencyArb,
        (a: number, b: number, c: Currency): boolean => {
          fc.pre(a < b);
          return isInvalidMoney((): Money => Money.from(a, c).subtract(Money.from(b, c)));
        },
      ),
      CONFIG,
    );
  });

  it('property: amounts above the limit, negative or non-integer are rejected', (): void => {
    const invalidArb: fc.Arbitrary<number> = fc.oneof(
      fc.integer({ min: MAX_MONEY_CENTS + 1, max: Number.MAX_SAFE_INTEGER }),
      fc.integer({ min: Number.MIN_SAFE_INTEGER, max: -1 }),
      fc.double({ noNaN: false }).filter((n: number): boolean => !Number.isInteger(n)),
      fc.constantFrom(Number.NaN, Infinity, -Infinity, Number.MAX_VALUE),
    );
    fc.assert(
      fc.property(invalidArb, currencyArb, (n: number, c: Currency): boolean =>
        isInvalidMoney((): Money => Money.from(n, c)),
      ),
      CONFIG,
    );
  });

  it('property: valid amounts round trip through getValue and currency', (): void => {
    fc.assert(
      fc.property(amountArb, currencyArb, (a: number, c: Currency): boolean => {
        const m = Money.from(a, c);
        return m.getValue() === a && m.getCurrency() === c;
      }),
      CONFIG,
    );
  });

  it('property: multiply is exact or throws, never imprecise', (): void => {
    fc.assert(
      fc.property(
        amountArb,
        fc.integer({ min: 0, max: 100_000 }),
        currencyArb,
        (a: number, f: number, c: Currency): boolean => {
          const exact = BigInt(a) * BigInt(f);
          if (exact > BigInt(MAX_MONEY_CENTS)) {
            return isInvalidMoney((): Money => Money.from(a, c).multiply(f));
          }
          return Money.from(a, c).multiply(f).getValue() === Number(exact);
        },
      ),
      CONFIG,
    );
  });

  it('property: percentage never exceeds the base at or below 10000 bps and matches DOWN floor', (): void => {
    fc.assert(
      fc.property(
        amountArb,
        fc.integer({ min: 0, max: 10_000 }),
        fc.constantFrom(...Object.values(RoundingMode)),
        currencyArb,
        (a: number, bps: number, mode: RoundingMode, c: Currency): boolean => {
          const result = Money.from(a, c).percentage(bps, mode).getValue();
          const floor = Number((BigInt(a) * BigInt(bps)) / BigInt(10_000));
          return result <= a && (result === floor || result === floor + 1);
        },
      ),
      CONFIG,
    );
  });

  it('property: allocate conserves the total exactly', (): void => {
    fc.assert(
      fc.property(
        amountArb,
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 8 }),
        currencyArb,
        (a: number, ratios: number[], c: Currency): boolean => {
          fc.pre(ratios.some((r: number): boolean => r > 0));
          const parts = Money.from(a, c).allocate(ratios);
          const sum = parts.reduce((acc: number, p: Money): number => acc + p.getValue(), 0);
          return parts.length === ratios.length && sum === a;
        },
      ),
      CONFIG,
    );
  });
});
