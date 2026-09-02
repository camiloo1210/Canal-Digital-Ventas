import { InvalidSkuException } from '@/products/domain/exceptions/invalid-sku.exception';

export class Sku {
  private static readonly SKU_REGEX = /^[A-Z0-9-]{5,20}$/;

  private constructor(private readonly value: string) {}

  public static from(sku: string): Sku {
    if (!sku) {
      throw new InvalidSkuException('empty');
    }

    const formattedSku = sku.trim().toUpperCase();

    if (!this.SKU_REGEX.test(formattedSku)) {
      throw new InvalidSkuException(formattedSku);
    }

    return new Sku(formattedSku);
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Sku): boolean {
    return this.value === other.getValue();
  }
}
