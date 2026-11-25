import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  quoteCartLine,
  quoteCartSubtotal,
  isCartQuoteWithinLimit,
  type CartQuoteLine,
} from '@/carts/application/services/cart-quote';
import { MAX_MONEY_CENTS } from '@/shared/domain/money-limits';
import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';

const SEED: number = Number(process.env.FC_SEED ?? 20261108);
const CONFIG: fc.Parameters<unknown> = { numRuns: 500, seed: SEED };

const priceArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: MAX_MONEY_CENTS });
const currencyArb: fc.Arbitrary<string> = fc.constantFrom('COP', 'USD', 'EUR', 'MXN');

function lineArb(currency: fc.Arbitrary<string>): fc.Arbitrary<CartQuoteLine> {
  return fc.record({
    retailPriceCents: priceArb,
    wholesalePriceCents: fc.option(priceArb, { nil: null }),
    wholesaleMinQuantity: fc.option(fc.integer({ min: 0, max: 50 }), { nil: null }),
    currency,
    quantity: fc.integer({ min: 1, max: 1000 }),
  });
}

function expectedUnit(line: CartQuoteLine): number {
  const w = line.wholesalePriceCents;
  const m = line.wholesaleMinQuantity;
  return w !== null && m !== null && w > 0 && m >= 1 && line.quantity >= m
    ? w
    : line.retailPriceCents;
}

describe('cart quote property tests', (): void => {
  it('property: line total equals unit price times quantity in exact integer cents', (): void => {
    fc.assert(
      fc.property(lineArb(currencyArb), (line: CartQuoteLine): boolean => {
        const q = quoteCartLine(line);
        const unit = expectedUnit(line);
        return (
          q.unitPriceCents === unit &&
          BigInt(q.totalCents) === BigInt(unit) * BigInt(line.quantity) &&
          Number.isSafeInteger(q.totalCents)
        );
      }),
      CONFIG,
    );
  });

  it('property: subtotal equals the exact sum of line totals', (): void => {
    fc.assert(
      fc.property(
        currencyArb.chain((c: string): fc.Arbitrary<CartQuoteLine[]> =>
          fc.array(lineArb(fc.constant(c)), { minLength: 1, maxLength: 10 }),
        ),
        (lines: CartQuoteLine[]): boolean => {
          const expected = lines.reduce(
            (acc: bigint, l: CartQuoteLine): bigint =>
              acc + BigInt(expectedUnit(l)) * BigInt(l.quantity),
            BigInt(0),
          );
          return (
            BigInt(quoteCartSubtotal(lines)) === expected &&
            isCartQuoteWithinLimit(lines) === expected <= BigInt(MAX_MONEY_CENTS)
          );
        },
      ),
      CONFIG,
    );
  });

  it('property: permuting the lines never changes the subtotal', (): void => {
    fc.assert(
      fc.property(
        currencyArb.chain((c: string): fc.Arbitrary<CartQuoteLine[]> =>
          fc.array(lineArb(fc.constant(c)), { minLength: 1, maxLength: 10 }),
        ),
        fc.infiniteStream(fc.nat()),
        (lines: CartQuoteLine[], stream: Iterable<number>): boolean => {
          const shuffled = [...lines];
          const it = stream[Symbol.iterator]();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = (it.next().value as number) % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return quoteCartSubtotal(shuffled) === quoteCartSubtotal(lines);
        },
      ),
      CONFIG,
    );
  });

  it('property: zero, negative or non-integer quantity is rejected', (): void => {
    const badQty: fc.Arbitrary<number> = fc.oneof(
      fc.integer({ min: -1_000_000, max: 0 }),
      fc.double({ noNaN: false }).filter((n: number): boolean => !Number.isInteger(n)),
    );
    fc.assert(
      fc.property(
        lineArb(currencyArb),
        badQty,
        (line: CartQuoteLine, quantity: number): boolean => {
          try {
            quoteCartLine({ ...line, quantity });
            return false;
          } catch (error: unknown) {
            return error instanceof InvalidMoneyException;
          }
        },
      ),
      CONFIG,
    );
  });

  it('property: mixed currencies in one cart are always rejected', (): void => {
    fc.assert(
      fc.property(
        lineArb(fc.constant('COP')),
        lineArb(fc.constant('USD')),
        (a: CartQuoteLine, b: CartQuoteLine): boolean => {
          try {
            quoteCartSubtotal([a, b]);
            return false;
          } catch (error: unknown) {
            return error instanceof InvalidMoneyException && !isCartQuoteWithinLimit([a, b]);
          }
        },
      ),
      CONFIG,
    );
  });

  it('property: never loses integer precision, throws instead beyond the safe range', (): void => {
    fc.assert(
      fc.property(
        priceArb,
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (price: number, quantity: number): boolean => {
          const line: CartQuoteLine = {
            retailPriceCents: price,
            wholesalePriceCents: null,
            wholesaleMinQuantity: null,
            currency: 'COP',
            quantity,
          };
          const exact = BigInt(price) * BigInt(quantity);
          try {
            return BigInt(quoteCartLine(line).totalCents) === exact;
          } catch (error: unknown) {
            return (
              error instanceof InvalidMoneyException && exact > BigInt(Number.MAX_SAFE_INTEGER)
            );
          }
        },
      ),
      CONFIG,
    );
  });
});
