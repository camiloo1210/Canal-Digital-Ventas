import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';
import { Currency } from '@/shared/domain/enums/currency.enum';

export class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: Currency,
  ) {}

  public static from(amount: number, currency: Currency = Currency.USD): Money {
    if (amount === undefined || amount === null || isNaN(amount)) {
      throw new InvalidMoneyException('Invalid amount for Money. Must be a valid number.');
    }
    if (!Number.isInteger(amount)) {
      throw new InvalidMoneyException('Money amount must be an integer (e.g., cents).');
    }
    if (amount < 0) {
      throw new InvalidMoneyException('Amount cannot be negative.');
    }
    return new Money(amount, currency);
  }

  public equals(other: Money): boolean {
    if (!other) return false;
    return this.amount === other.amount && this.currency === other.currency;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new InvalidMoneyException('Subtracting resulted in a negative money amount.');
    }
    return new Money(result, this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyException(
        `Cannot operate on different currencies: ${this.currency} and ${other.currency}`,
      );
    }
  }

  public multiply(factor: number): Money {
    if (factor < 0) {
      throw new InvalidMoneyException('Factor cannot be negative.');
    }
    return new Money(Math.round(this.amount * factor), this.currency);
  }

  public getValue(): number {
    return this.amount;
  }
  public getCurrency(): Currency {
    return this.currency;
  }
}
