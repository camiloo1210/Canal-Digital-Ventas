import { Product, type ProductProps } from '@/products/domain/entities/product.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';

export const DEFAULT_TEST_TENANT_ID = 'tenant-1';

/** Valid, event-free product (reconstituted). Deterministic: no clock, no random ids. */
export function buildProduct(overrides: Partial<ProductProps> = {}): Product {
  return Product.reconstitute({
    id: createProductId('product-1'),
    name: ProductName.from('Test product'),
    price: Money.from(10, Currency.COP),
    cost: Money.from(5, Currency.COP),
    wholesalePrice: Money.from(0, Currency.COP),
    wholesaleMinQuantity: 0,
    description: 'Test description',
    stock: 10,
    categoryId: createCategoryId('category-1'),
    expirationDate: null,
    status: ProductStatus.ACTIVE,
    sku: Sku.from('SKU-00001'),
    tenantId: createTenantId(DEFAULT_TEST_TENANT_ID),
    seasonIds: [],
    imagePath: null,
    imageUrl: null,
    galleryUrls: [],
    hasVariants: false,
    variants: [],
    isVatExempt: false,
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    version: 0,
    ...overrides,
  });
}
