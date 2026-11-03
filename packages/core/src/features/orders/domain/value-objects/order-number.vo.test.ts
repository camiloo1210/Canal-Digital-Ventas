import { describe, expect, it } from 'vitest';
import {
  generateOrderNumber,
  isUnguessableOrderNumber,
  normalizeOrderNumber,
} from '@/orders/domain/value-objects/order-number.vo';

describe('order number', (): void => {
  it('has the ORD-XXXX-XXXX-XXXX shape with the readable alphabet only', (): void => {
    for (let index = 0; index < 200; index++) {
      expect(generateOrderNumber()).toMatch(/^ORD(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    }
  });

  it('is deterministic for given bytes and unbiased over the alphabet', (): void => {
    const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(generateOrderNumber((): Uint8Array => bytes)).toBe('ORD-0123-4567-89AB');
    expect(
      generateOrderNumber((): Uint8Array => Uint8Array.from(bytes, (b): number => b + 32)),
    ).toBe('ORD-0123-4567-89AB');
  });

  it('does not repeat across many draws', (): void => {
    const seen = new Set<string>();
    for (let index = 0; index < 20000; index++) seen.add(generateOrderNumber());
    expect(seen.size).toBe(20000);
  });

  it('accepts a typed reference with other separators and case', (): void => {
    expect(isUnguessableOrderNumber('ord k7m3 9qxd 4twb')).toBe(true);
    expect(isUnguessableOrderNumber('#ORD-K7M3-9QXD-4TWB')).toBe(true);
    expect(isUnguessableOrderNumber('ORD-K7M39QXD4TWB')).toBe(true);
  });

  it('treats the old six-digit numbers and malformed input as guessable', (): void => {
    expect(isUnguessableOrderNumber('ORD-268738')).toBe(false);
    expect(isUnguessableOrderNumber('ORD-K7M3-9QXD')).toBe(false);
    expect(isUnguessableOrderNumber('ORD-K7M3-9QXD-4TWBX')).toBe(false);
    expect(isUnguessableOrderNumber('')).toBe(false);
    expect(normalizeOrderNumber(' # ORD-1 ')).toBe('ord1');
  });
});
