import { InvalidCategoryDescriptionException } from '@/categories/domain/exceptions/invalid-category-description.exception';

export class CategoryDescription {
  private constructor(private readonly value: string) {}

  public static from(description: string): CategoryDescription {
    if (description && description.length > 200) {
      throw new InvalidCategoryDescriptionException('must not exceed 200 characters.');
    }
    return new CategoryDescription(description ? description.trim() : '');
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: CategoryDescription): boolean {
    return this.value === other.getValue();
  }
}
