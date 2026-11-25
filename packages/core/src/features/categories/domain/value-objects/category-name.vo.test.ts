import { describe, it, expect } from 'vitest';
import { CategoryName } from '@/categories/domain/value-objects/category-name.vo';
import { InvalidCategoryNameException } from '@/categories/domain/exceptions/invalid-category-name.exception';

describe('CategoryName', (): void => {
  it.each([
    ['Books', 'Books'],
    ['  Books  ', 'Books'],
    ['a', 'a'],
    ['a'.repeat(100), 'a'.repeat(100)],
  ])('accepts %j and exposes %j', (input: string, expected: string): void => {
    expect(CategoryName.from(input).getValue()).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['over 100 characters', 'a'.repeat(101)],
  ])('rejects %s', (_label: string, input: string): void => {
    expect((): unknown => CategoryName.from(input)).toThrow(InvalidCategoryNameException);
    expect((): unknown => CategoryName.from(input)).toThrow(
      'Invalid category name: is required and must not exceed 100 characters.',
    );
  });

  it('rejects null-like input', (): void => {
    expect((): unknown => CategoryName.from(null as unknown as string)).toThrow(
      InvalidCategoryNameException,
    );
    expect((): unknown => CategoryName.from(undefined as unknown as string)).toThrow(
      InvalidCategoryNameException,
    );
  });

  it('measures the limit before trimming (101 chars with padding is rejected)', (): void => {
    expect((): unknown => CategoryName.from(' ' + 'a'.repeat(100))).toThrow(
      InvalidCategoryNameException,
    );
  });

  it('compares by trimmed value', (): void => {
    expect(CategoryName.from(' A ').equals(CategoryName.from('A'))).toBe(true);
    expect(CategoryName.from('A').equals(CategoryName.from('B'))).toBe(false);
  });
});
