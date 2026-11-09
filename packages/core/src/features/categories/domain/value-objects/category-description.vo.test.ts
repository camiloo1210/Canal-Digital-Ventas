import { describe, it, expect } from 'vitest';
import { CategoryDescription } from '@/categories/domain/value-objects/category-description.vo';
import { InvalidCategoryDescriptionException } from '@/categories/domain/exceptions/invalid-category-description.exception';

describe('CategoryDescription', (): void => {
  it.each([
    ['Some text', 'Some text'],
    ['  padded  ', 'padded'],
    ['', ''],
    ['a'.repeat(200), 'a'.repeat(200)],
  ])('accepts %j and exposes %j', (input: string, expected: string): void => {
    expect(CategoryDescription.from(input).getValue()).toBe(expected);
  });

  it('normalizes null-like input to an empty description', (): void => {
    expect(CategoryDescription.from(null as unknown as string).getValue()).toBe('');
    expect(CategoryDescription.from(undefined as unknown as string).getValue()).toBe('');
  });

  it('rejects more than 200 characters', (): void => {
    const build = (): CategoryDescription => CategoryDescription.from('a'.repeat(201));
    expect(build).toThrow(InvalidCategoryDescriptionException);
    expect(build).toThrow('Invalid category description: must not exceed 200 characters.');
  });

  it('compares by trimmed value', (): void => {
    expect(CategoryDescription.from(' x ').equals(CategoryDescription.from('x'))).toBe(true);
    expect(CategoryDescription.from('x').equals(CategoryDescription.from('y'))).toBe(false);
  });
});
