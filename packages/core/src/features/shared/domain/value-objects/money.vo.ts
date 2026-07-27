export class Money {
    private constructor(
        private readonly amount: number,
        private readonly currency: string
    ) { }


    public static from(amount: number, currency: string = 'USD'): Money {
        if (amount === undefined || amount === null || isNaN(amount)) {
            throw new Error('Invalid amount for Money');
        }
        if (amount < 0) throw new Error('Amount cannot be negative.');
        return new Money(amount, currency.toUpperCase());
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
        return new Money(this.amount - other.amount, this.currency);
    }


    private assertSameCurrency(other: Money): void {
        if (this.currency !== other.currency) {
            throw new Error(`Cannot operate on different currencies: ${this.currency} and ${other.currency}`);
        }
    }

    public getValue(): number { return this.amount; }
    public getCurrency(): string { return this.currency; }
}