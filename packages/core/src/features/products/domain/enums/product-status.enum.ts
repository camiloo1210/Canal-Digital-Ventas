import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  ARCHIVED = 'archived',
}
export function parseProductStatus(value: string): ProductStatus {
  const isValid = Object.values(ProductStatus).includes(value as ProductStatus);

  if (!isValid) {
    throw new InvalidProductAttributeException(`'${value}' no es un estado de producto válido.`);
  }

  return value as ProductStatus;
}
