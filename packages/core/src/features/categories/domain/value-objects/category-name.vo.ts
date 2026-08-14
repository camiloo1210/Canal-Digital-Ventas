import { InvalidCategoryNameException } from '@/categories/domain/exceptions/invalid-category-name.exception';

export class CategoryName {
  private constructor(private readonly value: string) {}

  public static from(name: string): CategoryName {
    if (!name || name.trim().length === 0 || name.length > 100) {
      throw new InvalidCategoryNameException('is required and must not exceed 100 characters.');
    }
    return new CategoryName(name.trim());
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: CategoryName): boolean {
    return this.value === other.getValue();
  }
}
