import { describe, expect, it } from 'vitest';
import { DocumentId } from '@/customers/domain/value-objects/document-id.vo';
import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

describe('DocumentId', (): void => {
  it.each([
    ['12345', '12345'],
    ['  ab-123  ', 'AB-123'],
    ['cc12345678', 'CC12345678'],
    ['a'.repeat(20), 'A'.repeat(20)],
  ])('accepts %j and normalizes to %j', (input: string, expected: string): void => {
    expect(DocumentId.from(input).getValue()).toBe(expected);
  });

  it.each([
    ['empty', '', 'Document ID is required and cannot be empty.'],
    ['whitespace only', '   ', 'Document ID is required and cannot be empty.'],
    ['null-like', null as unknown as string, 'Document ID is required and cannot be empty.'],
    ['4 characters', '1234', 'Document ID length must be between 5 and 20 characters.'],
    [
      '4 characters after trim',
      '  1234  ',
      'Document ID length must be between 5 and 20 characters.',
    ],
    ['21 characters', '1'.repeat(21), 'Document ID length must be between 5 and 20 characters.'],
  ])('rejects %s', (_label: string, input: string, message: string): void => {
    expect((): DocumentId => DocumentId.from(input)).toThrow(InvalidCustomerAttributeException);
    expect((): DocumentId => DocumentId.from(input)).toThrow(message);
  });

  // FINDING: the VO only checks length, so characters such as '<script>' pass. Expected: reject.
  it.fails('rejects wrong characters', (): void => {
    expect((): DocumentId => DocumentId.from('<script>1')).toThrow(
      InvalidCustomerAttributeException,
    );
  });
});
