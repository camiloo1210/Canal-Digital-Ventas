import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import { Currency } from '@/shared/domain/enums/currency.enum';

import { MAX_MONEY_CENTS } from '@/shared/domain/money-limits';
import {
  currencyExponent,
  decimalStringToMinor,
  minorToDecimalString,
} from '@/shared/domain/money-format';
import { RoundingMode } from '@/shared/domain/rounding-mode';

export { MAX_MONEY_CENTS } from '@/shared/domain/money-limits';

export class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: Currency,
  ) {}

  public static from(amount: number, currency: Currency): Money {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MONEY_CENTS) {
      throw new InvalidMoneyException(
        'Money amount must be a nonnegative safe integer within the commercial limit.',
      );
    }
    if (!Object.values(Currency).includes(currency)) {
      throw new InvalidMoneyException('Invalid money currency.');
    }
    return new Money(amount, currency);
  }

  public equals(other: Money): boolean {
    if (!other) return false;
    return this.amount === other.amount && this.currency === other.currency;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromExact(BigInt(this.amount) + BigInt(other.amount), this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = BigInt(this.amount) - BigInt(other.amount);
    if (result < BigInt(0)) {
      throw new InvalidMoneyException('Subtracting resulted in a negative money amount.');
    }
    return Money.fromExact(result, this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyException(
        `Cannot operate on different currencies: ${this.currency} and ${other.currency}`,
      );
    }
  }

  public multiply(factor: number): Money {
    if (!Number.isSafeInteger(factor) || factor < 0) {
      throw new InvalidMoneyException('Factor must be a nonnegative safe integer.');
    }
    return Money.fromExact(BigInt(this.amount) * BigInt(factor), this.currency);
  }

  private static fromExact(amount: bigint, currency: Currency): Money {
    if (amount < BigInt(0) || amount > BigInt(MAX_MONEY_CENTS)) {
      throw new InvalidMoneyException('Money result exceeds the commercial limit.');
    }
    return Money.from(Number(amount), currency);
  }

  public get exponent(): number {
    return currencyExponent(this.currency);
  }

  public toDecimalString(): string {
    return minorToDecimalString(this.amount, this.currency);
  }

  public static fromDecimalString(text: string, currency: Currency): Money {
    if (!Object.values(Currency).includes(currency)) {
      throw new InvalidMoneyException('Invalid money currency.');
    }
    try {
      return Money.from(decimalStringToMinor(text, currency), currency);
    } catch (error: unknown) {
      if (error instanceof InvalidMoneyException) throw error;
      throw new InvalidMoneyException(
        error instanceof Error ? error.message : 'Invalid monetary value',
      );
    }
  }

  public percentage(basisPoints: number, mode: RoundingMode): Money {
    if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
      throw new InvalidMoneyException('Basis points must be a nonnegative safe integer.');
    }
    const numerator = BigInt(this.amount) * BigInt(basisPoints);
    const divisor = BigInt(10000);
    const quotient = numerator / divisor;
    const remainder = numerator % divisor;
    const twice = remainder * BigInt(2);
    let result = quotient;
    if (mode === RoundingMode.HALF_UP) {
      if (twice >= divisor) result = quotient + BigInt(1);
    } else if (mode === RoundingMode.HALF_EVEN) {
      if (twice > divisor || (twice === divisor && quotient % BigInt(2) === BigInt(1))) {
        result = quotient + BigInt(1);
      }
    } else if (mode !== RoundingMode.DOWN) {
      throw new InvalidMoneyException('Invalid rounding mode.');
    }
    return Money.fromExact(result, this.currency);
  }

  public allocate(ratios: readonly number[]): Money[] {
    if (
      ratios.length === 0 ||
      ratios.some((r: number): boolean => !Number.isSafeInteger(r) || r < 0)
    ) {
      throw new InvalidMoneyException('Ratios must be nonnegative safe integers.');
    }
    const total = ratios.reduce((acc: bigint, r: number): bigint => acc + BigInt(r), BigInt(0));
    if (total === BigInt(0)) {
      throw new InvalidMoneyException('At least one ratio must be greater than zero.');
    }
    const whole = BigInt(this.amount);
    const shares = ratios.map((r: number): bigint => (whole * BigInt(r)) / total);
    const remainders = ratios.map((r: number): bigint => (whole * BigInt(r)) % total);
    let left = whole - shares.reduce((acc: bigint, v: bigint): bigint => acc + v, BigInt(0));
    const order = ratios
      .map((_: number, i: number): number => i)
      .sort((a: number, b: number): number => {
        if (remainders[a] === remainders[b]) return a - b;
        return remainders[a] > remainders[b] ? -1 : 1;
      });
    for (const i of order) {
      if (left === BigInt(0)) break;
      if (ratios[i] === 0) continue;
      shares[i] += BigInt(1);
      left -= BigInt(1);
    }
    return shares.map((v: bigint): Money => Money.fromExact(v, this.currency));
  }

  public getValue(): number {
    return this.amount;
  }
  public getCurrency(): Currency {
    return this.currency;
  }
}
