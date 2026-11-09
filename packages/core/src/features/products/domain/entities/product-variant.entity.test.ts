import { describe, expect, it } from 'vitest';
import { ProductVariant } from '@/products/domain/entities/product-variant.entity';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { Currency } from '@/shared/domain/enums/currency.enum';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createVariantId } from '@/products/domain/types/variant-id.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';
import { InvalidProductStateException } from '@/products/domain/exceptions/invalid-product-state.exception';

function buildVariant(stock: number, status?: ProductStatus): ProductVariant {
  return ProductVariant.create(
    createVariantId('variant-1'),
    createProductId('product-1'),
    Sku.from('CAFE01-L'),
    ProductName.from('Cafe L'),
    { size: 'L' },
    stock,
    undefined,
    status,
  );
}

describe('ProductVariant entity', (): void => {
  describe('create', (): void => {
    it('defaults to ACTIVE with positive stock and OUT_OF_STOCK with zero stock', (): void => {
      expect(buildVariant(3).getStatus()).toBe(ProductStatus.ACTIVE);
      expect(buildVariant(0).getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it('rejects negative stock', (): void => {
      expect((): unknown => buildVariant(-1)).toThrow(
        new InvalidProductAttributeException('Variant stock cannot be negative.'),
      );
    });
  });

  describe('updateStock', (): void => {
    it('moves ACTIVE to OUT_OF_STOCK at zero', (): void => {
      const variant = buildVariant(3);

      variant.updateStock(0);

      expect(variant.getStock()).toBe(0);
      expect(variant.getStatus()).toBe(ProductStatus.OUT_OF_STOCK);
    });

    it('moves OUT_OF_STOCK to ACTIVE when stock is positive', (): void => {
      const variant = buildVariant(0);

      variant.updateStock(2);

      expect(variant.getStock()).toBe(2);
      expect(variant.getStatus()).toBe(ProductStatus.ACTIVE);
    });

    it.each([ProductStatus.ARCHIVED, ProductStatus.INACTIVE])(
      'keeps %s status regardless of stock',
      (status: ProductStatus): void => {
        const variant = buildVariant(3, status);

        variant.updateStock(0);
        expect(variant.getStatus()).toBe(status);
        variant.updateStock(5);
        expect(variant.getStatus()).toBe(status);
      },
    );

    it('rejects negative stock and leaves state unchanged', (): void => {
      const variant = buildVariant(3);

      expect((): unknown => variant.updateStock(-1)).toThrow(
        new InvalidProductAttributeException('Stock cannot be negative.'),
      );
      expect(variant.getStock()).toBe(3);
    });

    // FINDING: updateStock only checks `< 0`, so NaN and fractional stock are accepted.
    it.fails('rejects NaN stock', (): void => {
      const variant = buildVariant(3);

      expect((): unknown => variant.updateStock(Number.NaN)).toThrow(
        InvalidProductAttributeException,
      );
    });

    it.fails('rejects fractional stock', (): void => {
      const variant = buildVariant(3);

      expect((): unknown => variant.updateStock(1.5)).toThrow(InvalidProductAttributeException);
    });
  });

  describe('updateAttributes', (): void => {
    it('replaces the attributes', (): void => {
      const variant = buildVariant(3);

      variant.updateAttributes({ size: 'XL', color: 'red' });

      expect(variant.getAttributes()).toEqual({ size: 'XL', color: 'red' });
    });

    it('returns a defensive copy from getAttributes', (): void => {
      const variant = buildVariant(3);

      variant.getAttributes().size = 'tampered';

      expect(variant.getAttributes()).toEqual({ size: 'L' });
    });

    // Variants carry no version or updatedAt: those live on the owning Product (setVariants).
  });

  describe('updatePriceOverride', (): void => {
    it('rejects a zero override (negative Money cannot be constructed)', (): void => {
      const variant = buildVariant(3);

      expect((): unknown => variant.updatePriceOverride(Money.from(0, Currency.COP))).toThrow(
        new InvalidProductAttributeException('Price override must be positive.'),
      );
      expect(variant.getPriceOverride()).toBeNull();
    });

    it('accepts a positive override and clears it with null', (): void => {
      const variant = buildVariant(3);

      variant.updatePriceOverride(Money.from(500, Currency.COP));
      expect(variant.getPriceOverride()?.getValue()).toBe(500);

      variant.updatePriceOverride(null);
      expect(variant.getPriceOverride()).toBeNull();
    });
  });

  describe('archive', (): void => {
    it('archives once and rejects a second archive', (): void => {
      const variant = buildVariant(3);

      variant.archive();

      expect(variant.getStatus()).toBe(ProductStatus.ARCHIVED);
      expect((): unknown => variant.archive()).toThrow(
        new InvalidProductStateException('Variant is already archived.'),
      );
    });
  });
});
