import { describe, expect, it } from 'vitest';
import { CustomerName } from '@/customers/domain/value-objects/customer-name.vo';
import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

describe('CustomerName', (): void => {
  it.each([
    ['Ana', 'Ana'],
    ['  Ana Perez  ', 'Ana Perez'],
    ['a'.repeat(100), 'a'.repeat(100)],
    ['  ' + 'a'.repeat(100) + '  ', 'a'.repeat(100)],
  ])('accepts %j and stores the trimmed value', (input: string, expected: string): void => {
    expect(CustomerName.from(input).getValue()).toBe(expected);
  });

  it.each([
    ['empty', '', 'Invalid customer attribute: Customer name is required and cannot be empty.'],
    [
      'whitespace only',
      '   ',
      'Invalid customer attribute: Customer name is required and cannot be empty.',
    ],
    [
      'null-like',
      null as unknown as string,
      'Invalid customer attribute: Customer name is required and cannot be empty.',
    ],
    [
      'undefined-like',
      undefined as unknown as string,
      'Invalid customer attribute: Customer name is required and cannot be empty.',
    ],
    [
      'over 100 characters',
      'a'.repeat(101),
      'Invalid customer attribute: Customer name cannot exceed 100 characters.',
    ],
  ])('rejects %s', (_label: string, input: string, message: string): void => {
    expect((): CustomerName => CustomerName.from(input)).toThrow(InvalidCustomerAttributeException);
    expect((): CustomerName => CustomerName.from(input)).toThrow(message);
  });
});
