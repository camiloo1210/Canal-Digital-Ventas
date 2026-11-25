import { describe, expect, it } from 'vitest';
import { PhoneNumber } from '@/customers/domain/value-objects/phone-number.vo';
import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

describe('PhoneNumber', (): void => {
  it.each([
    ['3001234', '3001234'],
    ['  +57 300 1234567  ', '+57 300 1234567'],
    ['300-123-4567', '300-123-4567'],
    ['1'.repeat(20), '1'.repeat(20)],
    ['+' + '1'.repeat(19), '+' + '1'.repeat(19)],
  ])('accepts %j and stores %j', (input: string, expected: string): void => {
    expect(PhoneNumber.from(input).getValue()).toBe(expected);
  });

  it.each([
    ['empty', '', 'Phone number is required and cannot be empty.'],
    ['whitespace only', '   ', 'Phone number is required and cannot be empty.'],
    ['null-like', null as unknown as string, 'Phone number is required and cannot be empty.'],
    ['6 digits', '123456', 'Phone number format is invalid.'],
    ['21 digits', '1'.repeat(21), 'Phone number format is invalid.'],
    ['letters', '300abc4567', 'Phone number format is invalid.'],
    ['plus in the middle', '300+1234567', 'Phone number format is invalid.'],
    ['parentheses', '(300) 1234567', 'Phone number format is invalid.'],
  ])('rejects %s', (_label: string, input: string, message: string): void => {
    expect((): PhoneNumber => PhoneNumber.from(input)).toThrow(InvalidCustomerAttributeException);
    expect((): PhoneNumber => PhoneNumber.from(input)).toThrow(message);
  });

  // FINDING: the regex counts spaces and hyphens as characters, so a value with 7 separators
  // and no digits passes. Expected: a phone number needs a minimum number of digits.
  it.fails('rejects a value without digits', (): void => {
    expect((): PhoneNumber => PhoneNumber.from('- - - - -')).toThrow(
      InvalidCustomerAttributeException,
    );
  });
});
