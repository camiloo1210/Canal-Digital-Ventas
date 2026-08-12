import { InvalidProductNameException } from '@/products/domain/exceptions/invalid-product-name.exception';

export class ProductName {
  private constructor(private readonly value: string) {}

  public static from(name: string): ProductName {
    if (!name || name.trim().length === 0) {
      throw new InvalidProductNameException('Name cannot be empty');
    }

    const sanitizedName = name.trim();

    if (sanitizedName.length < 2 || sanitizedName.length > 50) {
      throw new InvalidProductNameException('Name must be between 2 and 50 characters long');
    }

    return new ProductName(sanitizedName);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: ProductName): boolean {
    return this.value === other.getValue();
  }
}
