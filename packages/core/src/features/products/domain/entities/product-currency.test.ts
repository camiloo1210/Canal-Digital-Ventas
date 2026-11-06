import { describe, expect, it } from 'vitest';
import { Product, ProductProps } from '@/products/domain/entities/product.entity';
import { ProductVariant } from '@/products/domain/entities/product-variant.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createVariantId } from '@/products/domain/types/variant-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

function props(): ProductProps {
  return {
    id: createProductId('550e8400-e29b-41d4-a716-446655440000'),
    categoryId: createCategoryId('650e8400-e29b-41d4-a716-446655440000'),
    tenantId: createTenantId('750e8400-e29b-41d4-a716-446655440000'),
    name: ProductName.from('Cafe'),
    sku: Sku.from('CAFE01'),
    price: Money.from(10000, Currency.COP),
    cost: Money.from(1000, Currency.COP),
    wholesalePrice: Money.from(9000, Currency.COP),
    wholesaleMinQuantity: 2,
    stock: 10,
    description: '',
    expirationDate: null,
    status: ProductStatus.ACTIVE,
    seasonIds: [],
    imagePath: null,
    imageUrl: null,
    galleryUrls: [],
    hasVariants: false,
    variants: [],
    isVatExempt: false,
    updatedAt: new Date('2026-01-01'),
    version: 0,
  };
}
function variant(currency: Currency): ProductVariant {
  return ProductVariant.create(
    createVariantId('850e8400-e29b-41d4-a716-446655440000'),
    props().id,
    Sku.from('CAFE02'),
    ProductName.from('Grande'),
    {},
    2,
    Money.from(12000, currency),
  );
}
function create(p: ProductProps): Product {
  return Product.create(
    p.id,
    p.name,
    p.price,
    p.cost,
    p.description,
    p.stock,
    p.categoryId,
    p.sku,
    p.tenantId,
    p.expirationDate,
    p.status,
    p.seasonIds,
    p.imagePath,
    p.variants,
    p.isVatExempt,
    p.wholesalePrice,
    p.wholesaleMinQuantity,
  );
}

describe('Product currency invariant', (): void => {
  it.each(['create', 'reconstitute', 'setVariants'] as const)(
    'isolates mutable variant references on %s and getVariants',
    (method): void => {
      const original = variant(Currency.COP);
      const input = { ...props(), variants: [original], hasVariants: true };
      const product =
        method === 'create'
          ? create(input)
          : Product.reconstitute(method === 'setVariants' ? props() : input);
      if (method === 'setVariants') product.setVariants([original]);
      original.updatePriceOverride(Money.from(100, Currency.USD));
      const exposed = product.getVariants()[0];
      exposed.updatePriceOverride(Money.from(200, Currency.USD));
      expect(product.getVariants()[0].getPriceOverride()?.getCurrency()).toBe(Currency.COP);
      expect(product.getVariants()[0].getPriceOverride()?.getValue()).toBe(12000);
      const replacement = product.getVariants()[0];
      replacement.updatePriceOverride(Money.from(13000, Currency.COP));
      product.setVariants([replacement]);
      expect(product.getVariants()[0].getPriceOverride()?.getValue()).toBe(13000);
    },
  );

  it.each(['price', 'cost', 'wholesalePrice'] as const)(
    'rejects mixed %s currency at both factories',
    (field): void => {
      const mixed = { ...props(), [field]: Money.from(2000, Currency.USD) };
      expect((): Product => create(mixed)).toThrow(InvalidProductAttributeException);
      expect((): Product => Product.reconstitute(mixed)).toThrow(InvalidProductAttributeException);
    },
  );
  it('rejects variant overrides in another currency at both factories', (): void => {
    const mixed = { ...props(), variants: [variant(Currency.USD)] };
    expect((): Product => create(mixed)).toThrow(InvalidProductAttributeException);
    expect((): Product => Product.reconstitute(mixed)).toThrow(InvalidProductAttributeException);
  });
  it('accepts consistent non-USD amounts and overrides', (): void => {
    const product = create({ ...props(), variants: [variant(Currency.COP)] });
    expect(product.getPrice().getCurrency()).toBe(Currency.COP);
    expect(product.getVariants()[0].getPriceOverride()?.getCurrency()).toBe(Currency.COP);
  });
  it.each([
    [Money.from(15000, Currency.COP), Money.from(2000, Currency.USD)],
    [Money.from(15000, Currency.USD), Money.from(2000, Currency.USD)],
  ])('rejects price or cost relabeling before mutating any state', (price, cost): void => {
    const product = Product.reconstitute(props());
    expect((): void => product.changePricing(price, cost)).toThrow(
      InvalidProductAttributeException,
    );
    expect(product.getPrice().getValue()).toBe(10000);
    expect(product.getCost().getValue()).toBe(1000);
    expect(product.getPrice().getCurrency()).toBe(Currency.COP);
    expect(product.getCost().getCurrency()).toBe(Currency.COP);
    expect(product.getVersion()).toBe(0);
    expect(product.domainEvents).toEqual([]);
    expect(product.getUpdatedAt()).toEqual(props().updatedAt);
  });
  it('rejects wholesale relabeling without changing the offer', (): void => {
    const product = Product.reconstitute(props());
    expect((): void => product.changeWholesaleRules(Money.from(8000, Currency.USD), 3)).toThrow(
      InvalidProductAttributeException,
    );
    expect(product.getWholesalePrice().getValue()).toBe(9000);
    expect(product.getWholesaleMinQuantity()).toBe(2);
    expect(product.getWholesalePrice().getCurrency()).toBe(Currency.COP);
    expect(product.getVersion()).toBe(0);
    expect(product.domainEvents).toEqual([]);
  });
  it('rejects replacement variants before changing the existing collection', (): void => {
    const original = variant(Currency.COP);
    const product = Product.reconstitute({ ...props(), variants: [original], hasVariants: true });
    expect((): void => product.setVariants([variant(Currency.COP), variant(Currency.USD)])).toThrow(
      InvalidProductAttributeException,
    );
    expect(product.getVariants()).toEqual([original]);
    expect(product.getHasVariants()).toBe(true);
    expect(product.getVersion()).toBe(0);
    expect(product.domainEvents).toEqual([]);
  });
});
