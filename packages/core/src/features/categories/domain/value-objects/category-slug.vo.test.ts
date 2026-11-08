import { describe, it, expect } from 'vitest';
import { CategorySlug } from '@/categories/domain/value-objects/category-slug.vo';
import { InvalidCategorySlugException } from '@/categories/domain/exceptions/invalid-category-slug.exception';

describe('CategorySlug', (): void => {
  it('should format normal names correctly', (): void => {
    expect(CategorySlug.fromName('Electrónica').getValue()).toBe('electronica');
    expect(CategorySlug.fromName('Niños').getValue()).toBe('ninos');
    expect(CategorySlug.fromName('Café y Té').getValue()).toBe('cafe-y-te');
    expect(CategorySlug.fromName('Audio & Video').getValue()).toBe('audio-video');
  });

  it('should collapse multiple hyphens and trim', (): void => {
    expect(CategorySlug.fromName('  foo   bar  ').getValue()).toBe('foo-bar');
    expect(CategorySlug.fromName('---foo---bar---').getValue()).toBe('foo-bar');
  });

  it('should throw on completely empty or invalid names', (): void => {
    expect((): unknown => CategorySlug.fromName('')).toThrow(InvalidCategorySlugException);
    expect((): unknown => CategorySlug.fromName('!!!')).toThrow(InvalidCategorySlugException);
    expect((): unknown => CategorySlug.fromName('   ')).toThrow(InvalidCategorySlugException);
  });

  it('should truncate to exactly 100 characters', (): void => {
    const longName = 'a'.repeat(150);
    const slug = CategorySlug.fromName(longName);
    expect(slug.getValue().length).toBe(100);
    expect(slug.getValue()).toBe('a'.repeat(100));
  });

  it('should truncate and remove trailing hyphens', (): void => {
    const longName = 'a'.repeat(99) + ' b';
    const slug = CategorySlug.fromName(longName);
    // After replace it becomes a..a-b which is 101 length.
    // Truncating to 100 gives a..a-
    // Which then removes trailing hyphen, resulting in a..a (99 length)
    expect(slug.getValue()).toBe('a'.repeat(99));
    expect(slug.getValue().length).toBe(99);
  });

  describe('fromName normalization', (): void => {
    it.each([
      ['uppercase', 'HELLO', 'hello'],
      ['accents', 'Árbol Ñandú', 'arbol-nandu'],
      ['spaces', 'a b c', 'a-b-c'],
      ['symbols', 'a@#b$%c', 'a-b-c'],
      ['consecutive hyphens', 'a---b', 'a-b'],
      ['digits', 'Top 10', 'top-10'],
      ['leading/trailing symbols', '!!a!!', 'a'],
    ])('normalizes %s', (_label: string, input: string, expected: string): void => {
      expect(CategorySlug.fromName(input).getValue()).toBe(expected);
    });

    it.each([['!!!'], ['---'], ['@#$']])(
      'throws when %j is empty after cleaning',
      (input: string): void => {
        expect((): unknown => CategorySlug.fromName(input)).toThrow(
          'Invalid Category Slug: Name cannot be normalized into a valid slug.',
        );
      },
    );

    it('throws the specific message for empty input', (): void => {
      expect((): unknown => CategorySlug.fromName('')).toThrow(
        'Invalid Category Slug: Cannot generate slug from empty name.',
      );
    });
  });

  describe('create', (): void => {
    it.each([['a'], ['abc'], ['a-b'], ['a1-b2-c3'], ['a'.repeat(100)]])(
      'accepts %j',
      (value: string): void => {
        expect(CategorySlug.create(value).getValue()).toBe(value);
      },
    );

    it.each([
      ['empty', ''],
      ['whitespace only', '   '],
    ])('rejects %s with the empty message', (_label: string, value: string): void => {
      expect((): unknown => CategorySlug.create(value)).toThrow('Category slug cannot be empty.');
    });

    it('rejects values over 100 characters', (): void => {
      expect((): unknown => CategorySlug.create('a'.repeat(101))).toThrow(
        'Category slug cannot exceed 100 characters.',
      );
    });

    it.each([['Upper'], ['-a'], ['a-'], ['a--b'], ['a b'], ['á'], ['a_b']])(
      'rejects malformed %j',
      (value: string): void => {
        expect((): unknown => CategorySlug.create(value)).toThrow(InvalidCategorySlugException);
        expect((): unknown => CategorySlug.create(value)).toThrow(
          'Category slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.',
        );
      },
    );
  });

  describe('equals', (): void => {
    it('compares by value and is false for a missing other', (): void => {
      expect(CategorySlug.create('a').equals(CategorySlug.create('a'))).toBe(true);
      expect(CategorySlug.create('a').equals(CategorySlug.create('b'))).toBe(false);
      expect(CategorySlug.create('a').equals(null as unknown as CategorySlug)).toBe(false);
    });
  });
});
