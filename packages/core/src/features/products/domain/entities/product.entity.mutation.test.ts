import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Product, type ProductProps } from '@/products/domain/entities/product.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';
import { InvalidWholesaleRulesException } from '@/products/domain/exceptions/invalid-wholesale-rules.exception';
import { ProductPricingChangedEvent } from '@/products/domain/events/product-pricing-changed.event';
import { ProductDetailsChangedEvent } from '@/products/domain/events/product-details-changed.event';
import { ProductCreatedEvent } from '@/products/domain/events/product-created.event';
import type { DomainEvent } from '@/shared/domain/events/domain-event.interface';

// Targets mutants that survived the baseline Stryker run on product.entity.ts.
const NOW = new Date('2026-01-15T12:00:00.000Z');
const cop = (amount: number): Money => Money.from(amount, Currency.COP);

function buildProduct(overrides: Partial<ProductProps> = {}): Product {
  return Product.reconstitute({
    id: createProductId('product-1'),
    categoryId: createCategoryId('category-1'),
    tenantId: createTenantId('tenant-1'),
    name: ProductName.from('Cafe'),
    sku: Sku.from('CAFE01'),
    price: cop(10000),
    cost: cop(1000),
    wholesalePrice: cop(9000),
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
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 3,
    ...overrides,
  });
}

function createWith(
  stock: number,
  status: ProductStatus | null,
  wholesalePrice: Money | null,
  wholesaleMinQuantity: number | null,
): Product {
  return Product.create(
    createProductId('product-1'),
    ProductName.from('Cafe'),
    cop(10000),
    cop(1000),
    '',
    stock,
    createCategoryId('category-1'),
    Sku.from('CAFE01'),
    createTenantId('tenant-1'),
    null,
    status,
    [],
    null,
    [],
    false,
    wholesalePrice,
    wholesaleMinQuantity,
  );
}

describe('Product mutation baseline', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach((): void => {
    vi.useRealTimers();
  });

  describe('decreaseStock boundary', (): void => {
    it('allows decreasing exactly the available stock down to zero', (): void => {
      const product = buildProduct({ stock: 5 });
      product.decreaseStock(5);
      expect(product.getStock()).toBe(0);
    });

    it('rejects one unit above the available stock with the exact message', (): void => {
      const product = buildProduct({ stock: 5 });
      expect((): void => product.decreaseStock(6)).toThrow(InvalidProductStateException);
      expect((): void => product.decreaseStock(6)).toThrow('Insufficient stock.');
      expect(product.getStock()).toBe(5);
    });
  });

  describe('adjustStock status transitions', (): void => {
    it('does not reactivate or deactivate an ARCHIVED product when stock changes', (): void => {
      const archived = buildProduct({ status: ProductStatus.ARCHIVED, stock: 3 });
      archived.adjustStock(0);
      expect(archived.getStatus()).toBe(ProductStatus.ARCHIVED);
      archived.adjustStock(7);
      expect(archived.getStatus()).toBe(ProductStatus.ARCHIVED);
    });

    it('keeps an ACTIVE product ACTIVE when stock stays positive', (): void => {
      const product = buildProduct({ stock: 3 });
      product.adjustStock(8);
      expect(product.getStatus()).toBe(ProductStatus.ACTIVE);
    });

    it('keeps an OUT_OF_STOCK product OUT_OF_STOCK while stock stays zero', (): void => {
      const product = buildProduct({ stock: 0, status: ProductStatus.OUT_OF_STOCK });
      product.adjustStock(0);
      expect(product.getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
    });
  });

  describe('creation defaults', (): void => {
    it('defaults the status from stock when none is given and emits ProductCreatedEvent', (): void => {
      const empty = createWith(0, null, null, null);
      const stocked = createWith(1, null, null, null);
      expect(empty.getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
      expect(stocked.getStatus()).toBe(ProductStatus.ACTIVE);
      expect(
        stocked.domainEvents.some((e: DomainEvent): boolean => e instanceof ProductCreatedEvent),
      ).toBe(true);
    });

    it('keeps an explicit status over the stock-derived default', (): void => {
      expect(createWith(0, ProductStatus.ACTIVE, null, null).getStatus()).toBe(
        ProductStatus.ACTIVE,
      );
    });

    it('rejects a description above 200 characters but accepts exactly 200', (): void => {
      const product = buildProduct();
      const category = createCategoryId('category-2');
      const sku = Sku.from('CAFE02');
      product.changeDetails(ProductName.from('Cafe'), 'x'.repeat(200), category, sku, [], false);
      expect(product.getDescription()).toHaveLength(200);
      expect((): void =>
        product.changeDetails(ProductName.from('Cafe'), 'x'.repeat(201), category, sku, [], false),
      ).toThrow();
    });
  });

  describe('wholesale rules', (): void => {
    it('rejects a minimum quantity without a wholesale price', (): void => {
      const product = buildProduct();
      expect((): void => product.changeWholesaleRules(cop(0), 1)).toThrow(
        InvalidWholesaleRulesException,
      );
      expect((): void => product.changeWholesaleRules(cop(0), 1)).toThrow(
        'Wholesale minimum quantity cannot be greater than 0 if there is no wholesale price.',
      );
    });

    it('requires a minimum quantity of at least 1 with a wholesale price, and accepts 1', (): void => {
      const product = buildProduct();
      expect((): void => product.changeWholesaleRules(cop(5000), 0)).toThrow(
        'Wholesale minimum quantity must be at least 1 when a wholesale price is set.',
      );
      product.changeWholesaleRules(cop(5000), 1);
      expect(product.getWholesaleMinQuantity()).toBe(1);
    });

    it('accepts no wholesale at all (price 0, minimum 0) and reports isWholesale accordingly', (): void => {
      const product = buildProduct();
      product.changeWholesaleRules(cop(0), 0);
      expect(product.isWholesale()).toBe(false);
      product.changeWholesaleRules(cop(1), 1);
      expect(product.isWholesale()).toBe(true);
    });

    it('rejects wholesale rules at creation that break the pairing', (): void => {
      expect((): Product => createWith(1, null, cop(0), 3)).toThrow(InvalidWholesaleRulesException);
      expect((): Product => createWith(1, null, cop(5000), 0)).toThrow(
        InvalidWholesaleRulesException,
      );
    });

    it('rejects a wholesale price in another currency and keeps the old rules', (): void => {
      const product = buildProduct();
      expect((): void => product.changeWholesaleRules(Money.from(5000, Currency.USD), 2)).toThrow();
      expect(product.getWholesalePrice().getValue()).toBe(9000);
    });
  });

  describe('events and timestamps', (): void => {
    it('changePricing emits ProductPricingChangedEvent and refreshes updatedAt', (): void => {
      const product = buildProduct();
      product.changePricing(cop(12000), cop(2000));
      expect(
        product.domainEvents.some(
          (e: DomainEvent): boolean => e instanceof ProductPricingChangedEvent,
        ),
      ).toBe(true);
      expect(product.getUpdatedAt()).toEqual(NOW);
      expect(product.getPrice().getValue()).toBe(12000);
      expect(product.getCost().getValue()).toBe(2000);
    });

    it('changePricing rejects a cost in another currency without emitting', (): void => {
      const product = buildProduct();
      expect((): void =>
        product.changePricing(cop(12000), Money.from(2000, Currency.USD)),
      ).toThrow();
      expect(product.domainEvents).toHaveLength(0);
    });

    it('changeWholesaleRules emits ProductPricingChangedEvent and refreshes updatedAt', (): void => {
      const product = buildProduct();
      product.changeWholesaleRules(cop(8000), 3);
      expect(
        product.domainEvents.some(
          (e: DomainEvent): boolean => e instanceof ProductPricingChangedEvent,
        ),
      ).toBe(true);
      expect(product.getUpdatedAt()).toEqual(NOW);
    });

    it('changeDetails emits ProductDetailsChangedEvent', (): void => {
      const product = buildProduct();
      product.changeDetails(
        ProductName.from('Te'),
        'desc',
        createCategoryId('category-2'),
        Sku.from('TEA001'),
        [],
        true,
      );
      expect(
        product.domainEvents.some(
          (e: DomainEvent): boolean => e instanceof ProductDetailsChangedEvent,
        ),
      ).toBe(true);
      expect(product.getIsVatExempt()).toBe(true);
    });
  });
});
