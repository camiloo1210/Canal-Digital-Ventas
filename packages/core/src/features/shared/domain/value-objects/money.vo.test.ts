import { describe, expect, it } from 'vitest';
import { Money, MAX_MONEY_CENTS } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { RoundingMode } from '@/shared/domain/rounding-mode';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';

describe('Money exact commercial arithmetic', (): void => {
  it.each([NaN, Infinity, -Infinity, -1, 1.1, Number.MAX_SAFE_INTEGER + 1, MAX_MONEY_CENTS + 1])(
    'rejects invalid amounts %s',
    (amount: number): void => {
      expect((): Money => Money.from(amount, Currency.USD)).toThrow(InvalidMoneyException);
    },
  );
  it('rejects invalid runtime currencies', (): void => {
    expect((): Money => Money.from(1, 'INVALID' as Currency)).toThrow(InvalidMoneyException);
  });
  it.each([NaN, Infinity, -Infinity, -1, 0.1, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid quantity factors %s',
    (factor: number): void => {
      expect((): Money => Money.from(1, Currency.USD).multiply(factor)).toThrow(
        InvalidMoneyException,
      );
    },
  );
  it('checks all operation results against the persisted limit', (): void => {
    const maximum = Money.from(MAX_MONEY_CENTS, Currency.USD);
    expect((): Money => maximum.add(Money.from(1, Currency.USD))).toThrow(InvalidMoneyException);
    expect((): Money => maximum.multiply(Number.MAX_SAFE_INTEGER)).toThrow(InvalidMoneyException);
    expect((): Money => Money.from(0, Currency.USD).subtract(Money.from(1, Currency.USD))).toThrow(
      InvalidMoneyException,
    );
    expect(maximum.subtract(Money.from(1, Currency.USD)).getValue()).toBe(MAX_MONEY_CENTS - 1);
    expect(Money.from(1, Currency.USD).multiply(MAX_MONEY_CENTS).equals(maximum)).toBe(true);
    expect(maximum.multiply(0).getValue()).toBe(0);
  });
  it('requires common currencies for addition and subtraction', (): void => {
    expect((): Money => Money.from(1, Currency.COP).add(Money.from(1, Currency.USD))).toThrow(
      InvalidMoneyException,
    );
    expect((): Money => Money.from(1, Currency.COP).subtract(Money.from(1, Currency.USD))).toThrow(
      InvalidMoneyException,
    );
  });
});

describe.each([
  { currency: Currency.USD, exponent: 2, amount: 12345, text: '123.45', bad: '1.234' },
  { currency: Currency.COP, exponent: 2, amount: 5000, text: '50.00', bad: '1.234' },
  { currency: Currency.CLP, exponent: 0, amount: 5000, text: '5000', bad: '10.5' },
])('Money $currency', ({ currency, exponent, amount, text, bad }): void => {
  it('exposes exponent and decimal conversions', (): void => {
    const money = Money.from(amount, currency);
    expect(money.exponent).toBe(exponent);
    expect(money.toDecimalString()).toBe(text);
    expect(Money.fromDecimalString(text, currency).equals(money)).toBe(true);
    expect((): Money => Money.fromDecimalString(bad, currency)).toThrow(InvalidMoneyException);
  });
  it('rejects multiply overflow and mixed currencies', (): void => {
    expect((): Money => Money.from(MAX_MONEY_CENTS, currency).multiply(2)).toThrow(
      InvalidMoneyException,
    );
    const other = currency === Currency.EUR ? Currency.USD : Currency.EUR;
    expect((): Money => Money.from(1, currency).add(Money.from(1, other))).toThrow(
      InvalidMoneyException,
    );
  });
  it('allocates largest remainder so parts sum exactly', (): void => {
    const parts = Money.from(100, currency).allocate([1, 1, 1]);
    expect(parts.map((p: Money): number => p.getValue())).toEqual([34, 33, 33]);
    const zero = Money.from(100, currency).allocate([1, 0, 1]);
    expect(zero.map((p: Money): number => p.getValue())).toEqual([50, 0, 50]);
    const odd = Money.from(7, currency).allocate([3, 0, 3, 1]);
    expect(odd.reduce((a: number, p: Money): number => a + p.getValue(), 0)).toBe(7);
    expect((): Money[] => Money.from(1, currency).allocate([0, 0])).toThrow(InvalidMoneyException);
    expect((): Money[] => Money.from(1, currency).allocate([-1, 2])).toThrow(InvalidMoneyException);
  });
  it('applies percentage rounding modes', (): void => {
    // 250 * 100bps = 2.5
    const m = Money.from(250, currency);
    expect(m.percentage(100, RoundingMode.HALF_UP).getValue()).toBe(3);
    expect(m.percentage(100, RoundingMode.HALF_EVEN).getValue()).toBe(2);
    expect(m.percentage(100, RoundingMode.DOWN).getValue()).toBe(2);
    const n = Money.from(350, currency); // 3.5
    expect(n.percentage(100, RoundingMode.HALF_EVEN).getValue()).toBe(4);
    expect(Money.from(199, currency).percentage(100, RoundingMode.HALF_UP).getValue()).toBe(2);
    expect(Money.from(199, currency).percentage(100, RoundingMode.DOWN).getValue()).toBe(1);
    expect((): Money => m.percentage(-1, RoundingMode.DOWN)).toThrow(InvalidMoneyException);
  });
});
