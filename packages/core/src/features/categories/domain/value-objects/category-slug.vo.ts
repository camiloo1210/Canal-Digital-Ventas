import { InvalidCategorySlugException } from '../exceptions/invalid-category-slug.exception';

export class CategorySlug {
  public static readonly MAX_LENGTH = 100;

  private constructor(private readonly value: string) {}

  public static create(value: string): CategorySlug {
    if (!value || value.trim().length === 0) {
      throw new InvalidCategorySlugException('Category slug cannot be empty.');
    }
    if (value.length > CategorySlug.MAX_LENGTH) {
      throw new InvalidCategorySlugException(`Category slug cannot exceed ${CategorySlug.MAX_LENGTH} characters.`);
    }
    if (!/^[a-z0-9](-?[a-z0-9])*$/.test(value)) {
      throw new InvalidCategorySlugException('Category slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.');
    }
    return new CategorySlug(value);
  }

  public static fromName(name: string): CategorySlug {
    if (!name || name.trim().length === 0) {
      throw new InvalidCategorySlugException('Cannot generate slug from empty name.');
    }

    // 1. Trim and lowercase
    let normalized = name.trim().toLowerCase();

    // 2. Remove diacritics/accents
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 3. Replace invalid characters with hyphens
    normalized = normalized.replace(/[^a-z0-9]+/g, '-');

    // 4. Collapse multiple hyphens
    normalized = normalized.replace(/-+/g, '-');

    // 5. Remove leading/trailing hyphens
    normalized = normalized.replace(/^-+|-+$/g, '');

    // 6. Check if empty after normalization (e.g. "!!!")
    if (normalized.length === 0) {
      throw new InvalidCategorySlugException('Name cannot be normalized into a valid slug.');
    }

    // 7. Truncate to MAX_LENGTH if necessary
    if (normalized.length > CategorySlug.MAX_LENGTH) {
      normalized = normalized.substring(0, CategorySlug.MAX_LENGTH);
      // Remove trailing hyphen if truncation leaves one
      normalized = normalized.replace(/-+$/g, '');
    }

    return new CategorySlug(normalized);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: CategorySlug): boolean {
    if (!other) {
      return false;
    }
    return this.value === other.getValue();
  }
}
