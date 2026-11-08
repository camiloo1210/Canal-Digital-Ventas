import { describe, expect, it } from 'vitest';
import { PersonName } from '@/shared/domain/value-objects/person-name.vo';
import { InvalidPersonNameException } from '@/shared/domain/exceptions/invalid-person-name.exception';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';

describe('PersonName', (): void => {
  it.each([
    ['Ana', 'Ana'],
    ['  José Núñez  ', 'José Núñez'],
    ["O'Connor", "O'Connor"],
    ['Mary-Jane Üner', 'Mary-Jane Üner'],
    ['a'.repeat(100), 'a'.repeat(100)],
  ])('accepts %j and stores %j', (input: string, expected: string): void => {
    expect(PersonName.create(input).getValue()).toBe(expected);
  });

  it.each([
    ['empty', '', 'Person name cannot be empty'],
    ['whitespace only', '   ', 'Person name cannot be empty'],
    ['null-like', null as unknown as string, 'Person name cannot be empty'],
    [
      'over 100 characters',
      'a'.repeat(101),
      'Person name exceeds maximum length of 100 characters',
    ],
    ['digits', 'Ana2', 'Person name contains invalid characters'],
    ['markup', '<script>', 'Person name contains invalid characters'],
    ['dot', 'Ana P.', 'Person name contains invalid characters'],
  ])('rejects %s', (_label: string, input: string, message: string): void => {
    expect((): PersonName => PersonName.create(input)).toThrow(InvalidPersonNameException);
    expect((): PersonName => PersonName.create(input)).toThrow(message);
  });

  it('throws a DomainException subtype', (): void => {
    expect((): PersonName => PersonName.create('')).toThrow(DomainException);
  });

  it('reconstitute keeps the stored value without validation', (): void => {
    expect(PersonName.reconstitute('Stored Name').getValue()).toBe('Stored Name');
  });
});
