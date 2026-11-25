import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Product, ProductProps } from '@/products/domain/entities/product.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';
import { ProductStockAdjustedEvent } from '@/products/domain/events/product-stock-adjusted.event';
import { ProductArchivedEvent } from '@/products/domain/events/product-archived.event';

const NOW = new Date('2026-01-15T12:00:00.000Z');
const PRODUCT_ID = createProductId('product-1');

function buildProduct(overrides: Partial<ProductProps> = {}): Product {
  return Product.reconstitute({
    id: PRODUCT_ID,
    categoryId: createCategoryId('category-1'),
    tenantId: createTenantId('tenant-1'),
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
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 3,
    ...overrides,
  });
}

describe('Product entity (stock and status invariants)', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  describe('decreaseStock', (): void => {
    it.each([0, -1])('rejects non-positive quantity %s', (quantity: number): void => {
      const product = buildProduct();

      expect((): unknown => product.decreaseStock(quantity)).toThrow(
        new InvalidProductAttributeException('Decrease quantity must be strictly positive.'),
      );
      expect(product.getStock()).toBe(10);
    });

    // FINDING: decreaseStock(NaN) does not throw. `NaN <= 0` and `NaN > stock` are both false,
    // so the guard is skipped and stock becomes NaN. Expected: the strictly-positive error.
    it.fails('rejects NaN quantity', (): void => {
      const product = buildProduct();

      expect((): unknown => product.decreaseStock(Number.NaN)).toThrow(
        'Decrease quantity must be strictly positive.',
      );
    });

    it('rejects a quantity above stock and leaves stock unchanged', (): void => {
      const product = buildProduct({ stock: 3 });

      expect((): unknown => product.decreaseStock(4)).toThrow(
        new InvalidProductStateException('Insufficient stock.'),
      );
      expect(product.getStock()).toBe(3);
      expect(product.getVersion()).toBe(3);
    });

    it('decrements stock, refreshes updatedAt and bumps version', (): void => {
      const product = buildProduct({ stock: 10 });

      product.decreaseStock(4);

      expect(product.getStock()).toBe(6);
      expect(product.getUpdatedAt()).toEqual(NOW);
      expect(product.getVersion()).toBe(4);
    });

    it('keeps the product ACTIVE while stock remains', (): void => {
      const product = buildProduct({ stock: 10 });

      product.decreaseStock(9);

      expect(product.getStock()).toBe(1);
      expect(product.getStatus()).toBe(ProductStatus.ACTIVE);
    });

    // FINDING: decreaseStock to exactly 0 leaves an ACTIVE product ACTIVE with stock 0, while
    // adjustStock(0) moves it to OUT_OF_STOCK and changeStatus(ACTIVE) refuses stock 0.
    // SQL path checked: generate-commercial-order.use-case.ts:108-109 calls product.decreaseStock
    // and then productRepository.decreaseStock(), and the use case never calls save() afterwards,
    // so the entity status change would be discarded anyway. postgres-product.repository.ts:113
    // runs `SET stock = stock - q, version = version + 1, updated_at = NOW()` without touching
    // status, and no trigger on catalog.products maintains it. So the SQL path does NOT repair
    // the status: the row stays 'active' with stock 0. Only the public read views derive
    // OUT_OF_STOCK from `stock = 0`. Decision needed: fix decreaseStock (and persist status) or pin.
    it.fails('moves an ACTIVE product to OUT_OF_STOCK when stock reaches zero', (): void => {
      const product = buildProduct({ stock: 2, status: ProductStatus.ACTIVE });

      product.decreaseStock(2);

      expect(product.getStock()).toBe(0);
      expect(product.getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
    });
  });

  describe('adjustStock', (): void => {
    it('moves ACTIVE to OUT_OF_STOCK at zero', (): void => {
      const product = buildProduct({ status: ProductStatus.ACTIVE });

      product.adjustStock(0);

      expect(product.getStock()).toBe(0);
      expect(product.getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it('moves OUT_OF_STOCK to ACTIVE when stock is positive', (): void => {
      const product = buildProduct({ stock: 0, status: ProductStatus.OUT_OF_STOCK });

      product.adjustStock(5);

      expect(product.getStock()).toBe(5);
      expect(product.getStatus()).toBe(ProductStatus.ACTIVE);
    });

    it.each([0, 5])('keeps ARCHIVED status with stock %s', (stock: number): void => {
      const product = buildProduct({ status: ProductStatus.ARCHIVED });

      product.adjustStock(stock);

      expect(product.getStatus()).toBe(ProductStatus.ARCHIVED);
    });

    it.each([0, 5])('keeps INACTIVE status with stock %s', (stock: number): void => {
      const product = buildProduct({ status: ProductStatus.INACTIVE });

      product.adjustStock(stock);

      expect(product.getStatus()).toBe(ProductStatus.INACTIVE);
    });

    it('emits ProductStockAdjustedEvent with id and new stock and refreshes updatedAt', (): void => {
      const product = buildProduct();

      product.adjustStock(7);

      const events = product.domainEvents;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProductStockAdjustedEvent);
      expect(events[0]).toMatchObject({ productId: PRODUCT_ID, stock: 7 });
      expect(product.getUpdatedAt()).toEqual(NOW);
      expect(product.getVersion()).toBe(4);
    });

    it('rejects negative stock and leaves state unchanged', (): void => {
      const product = buildProduct();

      expect((): unknown => product.adjustStock(-1)).toThrow(
        new InvalidProductAttributeException('Stock must be a non-negative integer.'),
      );
      expect(product.getStock()).toBe(10);
      expect(product.domainEvents).toHaveLength(0);
    });

    // FINDING: validateStock only checks `stock < 0`, so fractional stock is accepted although
    // the message says "non-negative integer".
    it.fails('rejects non-integer stock', (): void => {
      const product = buildProduct();

      expect((): unknown => product.adjustStock(1.5)).toThrow(
        'Stock must be a non-negative integer.',
      );
    });

    // FINDING: NaN passes `stock < 0` and is stored as stock.
    it.fails('rejects NaN stock', (): void => {
      const product = buildProduct();

      expect((): unknown => product.adjustStock(Number.NaN)).toThrow(
        'Stock must be a non-negative integer.',
      );
    });
  });

  describe('changeStatus', (): void => {
    const A = ProductStatus.ACTIVE;
    const I = ProductStatus.INACTIVE;
    const O = ProductStatus.OUT_OF_STOCK;
    const R = ProductStatus.ARCHIVED;
    const ARCHIVED_MSG = 'Cannot change status of an archived product.';
    const USE_ARCHIVE_MSG = 'Use the archive() method to archive a product.';
    const OOS_MSG = 'Cannot set status to out_of_stock when stock is greater than 0.';
    const ACTIVE_MSG = 'Cannot set status to active when stock is 0.';

    // [current, requested, stock, expected status or error message]
    const table: [ProductStatus, ProductStatus, number, ProductStatus | string][] = [
      [A, A, 0, A],
      [A, A, 5, A],
      [I, I, 0, I],
      [I, I, 5, I],
      [O, O, 0, O],
      [O, O, 5, O],
      [R, R, 0, R],
      [R, R, 5, R],
      [R, A, 0, ARCHIVED_MSG],
      [R, A, 5, ARCHIVED_MSG],
      [R, I, 0, ARCHIVED_MSG],
      [R, I, 5, ARCHIVED_MSG],
      [R, O, 0, ARCHIVED_MSG],
      [R, O, 5, ARCHIVED_MSG],
      [A, R, 0, USE_ARCHIVE_MSG],
      [A, R, 5, USE_ARCHIVE_MSG],
      [I, R, 0, USE_ARCHIVE_MSG],
      [I, R, 5, USE_ARCHIVE_MSG],
      [O, R, 0, USE_ARCHIVE_MSG],
      [O, R, 5, USE_ARCHIVE_MSG],
      [A, I, 0, I],
      [A, I, 5, I],
      [A, O, 0, O],
      [A, O, 5, OOS_MSG],
      [I, A, 0, ACTIVE_MSG],
      [I, A, 5, A],
      [I, O, 0, O],
      [I, O, 5, OOS_MSG],
      [O, A, 0, ACTIVE_MSG],
      [O, A, 5, A],
      [O, I, 0, I],
      [O, I, 5, I],
    ];

    it.each(table)(
      'from %s to %s with stock %s -> %s',
      (
        current: ProductStatus,
        requested: ProductStatus,
        stock: number,
        expected: ProductStatus | string,
      ): void => {
        const product = buildProduct({ status: current, stock });
        const isStatus = Object.values(ProductStatus).includes(expected as ProductStatus);

        if (isStatus) {
          product.changeStatus(requested);
          expect(product.getStatus()).toBe(expected);
          const changed = current !== requested;
          expect(product.getVersion()).toBe(changed ? 4 : 3);
          expect(product.getUpdatedAt()).toEqual(
            changed ? NOW : new Date('2026-01-01T00:00:00.000Z'),
          );
        } else {
          expect((): unknown => product.changeStatus(requested)).toThrow(
            new InvalidProductStateException(expected),
          );
          expect(product.getStatus()).toBe(current);
          expect(product.getVersion()).toBe(3);
        }
      },
    );
  });

  describe('archive and unarchive', (): void => {
    it('archives, emits ProductArchivedEvent and refreshes updatedAt', (): void => {
      const product = buildProduct();

      product.archive();

      expect(product.getStatus()).toBe(ProductStatus.ARCHIVED);
      expect(product.domainEvents).toHaveLength(1);
      expect(product.domainEvents[0]).toBeInstanceOf(ProductArchivedEvent);
      expect(product.getUpdatedAt()).toEqual(NOW);
    });

    it('throws when archiving twice and emits no second event', (): void => {
      const product = buildProduct({ status: ProductStatus.ARCHIVED });

      expect((): unknown => product.archive()).toThrow(
        new InvalidProductStateException('Product is already archived.'),
      );
      expect(product.domainEvents).toHaveLength(0);
    });

    it('unarchives to ACTIVE when stock is positive', (): void => {
      const product = buildProduct({ status: ProductStatus.ARCHIVED, stock: 4 });

      product.unarchive();

      expect(product.getStatus()).toBe(ProductStatus.ACTIVE);
      expect(product.getVersion()).toBe(4);
    });

    it('unarchives to OUT_OF_STOCK when stock is zero', (): void => {
      const product = buildProduct({ status: ProductStatus.ARCHIVED, stock: 0 });

      product.unarchive();

      expect(product.getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it.each([ProductStatus.ACTIVE, ProductStatus.INACTIVE, ProductStatus.OUT_OF_STOCK])(
      'rejects unarchive from %s',
      (status: ProductStatus): void => {
        const product = buildProduct({ status });

        expect((): unknown => product.unarchive()).toThrow(
          new InvalidProductStateException('Only archived products can be unarchived.'),
        );
        expect(product.getStatus()).toBe(status);
      },
    );
  });

  describe('changeExpirationDate', (): void => {
    it('rejects a past date and keeps the previous one', (): void => {
      const product = buildProduct();

      expect((): unknown =>
        product.changeExpirationDate(new Date('2026-01-14T12:00:00.000Z')),
      ).toThrow(new InvalidProductAttributeException('Expiration date must be a future date.'));
      expect(product.getExpirationDate()).toBeNull();
    });

    it('rejects a date equal to now', (): void => {
      const product = buildProduct();

      expect((): unknown => product.changeExpirationDate(new Date(NOW))).toThrow(
        'Expiration date must be a future date.',
      );
    });

    it('accepts a future date', (): void => {
      const product = buildProduct();
      const future = new Date('2026-02-01T00:00:00.000Z');

      product.changeExpirationDate(future);

      expect(product.getExpirationDate()).toEqual(future);
      expect(product.getUpdatedAt()).toEqual(NOW);
    });

    it('clears the date with null', (): void => {
      const product = buildProduct({ expirationDate: new Date('2026-02-01T00:00:00.000Z') });

      product.changeExpirationDate(null);

      expect(product.getExpirationDate()).toBeNull();
      expect(product.getVersion()).toBe(4);
    });
  });
});
