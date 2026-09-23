import { describe, it, expect } from 'vitest';
import { CategorySlug } from './category-slug.vo';
import { InvalidCategorySlugException } from '../exceptions/invalid-category-slug.exception';

describe('CategorySlug', () => {
  it('should format normal names correctly', () => {
    expect(CategorySlug.fromName('Electrónica').getValue()).toBe('electronica');
    expect(CategorySlug.fromName('Niños').getValue()).toBe('ninos');
    expect(CategorySlug.fromName('Café y Té').getValue()).toBe('cafe-y-te');
    expect(CategorySlug.fromName('Audio & Video').getValue()).toBe('audio-video');
  });

  it('should collapse multiple hyphens and trim', () => {
    expect(CategorySlug.fromName('  foo   bar  ').getValue()).toBe('foo-bar');
    expect(CategorySlug.fromName('---foo---bar---').getValue()).toBe('foo-bar');
  });

  it('should throw on completely empty or invalid names', () => {
    expect(() => CategorySlug.fromName('')).toThrow(InvalidCategorySlugException);
    expect(() => CategorySlug.fromName('!!!')).toThrow(InvalidCategorySlugException);
    expect(() => CategorySlug.fromName('   ')).toThrow(InvalidCategorySlugException);
  });

  it('should truncate to exactly 100 characters', () => {
    const longName = 'a'.repeat(150);
    const slug = CategorySlug.fromName(longName);
    expect(slug.getValue().length).toBe(100);
    expect(slug.getValue()).toBe('a'.repeat(100));
  });

  it('should truncate and remove trailing hyphens', () => {
    const longName = 'a'.repeat(99) + ' b';
    const slug = CategorySlug.fromName(longName);
    // After replace it becomes a..a-b which is 101 length.
    // Truncating to 100 gives a..a-
    // Which then removes trailing hyphen, resulting in a..a (99 length)
    expect(slug.getValue()).toBe('a'.repeat(99));
    expect(slug.getValue().length).toBe(99);
  });
});
