import { describe, expect, it } from 'vitest';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { InvalidProductAttributeException } from '@/products/domain/exceptions/invalid-product-attribute.exception';

function product(): Product {
  return Product.create(
    createProductId('550e8400-e29b-41d4-a716-446655440000'),
    ProductName.from('Gallery product'),
    Money.from(10000),
    Money.from(1000),
    '',
    10,
    createCategoryId('650e8400-e29b-41d4-a716-446655440000'),
    Sku.from('ABC123'),
    createTenantId('750e8400-e29b-41d4-a716-446655440000'),
    null,
    null,
    [],
    null,
    [],
    false,
    null,
    null,
  );
}
const urls = (count: number): string[] =>
  Array.from({ length: count }, (_, i): string => `https://example.test/${i}.png`);

describe('Product gallery', (): void => {
  it('uses the first gallery image as the cover', (): void => {
    const p = product();
    p.updateGallery(urls(3));
    expect(p.getGalleryUrls()).toEqual(urls(3));
    expect(p.getImageUrl()).toBe(urls(3)[0]);
    expect(p.getImagePath()).toBe(urls(3)[0]);
  });
  it('clears the cover when the gallery is emptied', (): void => {
    const p = product();
    p.updateGallery(urls(2));
    p.updateGallery([]);
    expect(p.getImageUrl()).toBeNull();
    expect(p.getGalleryUrls()).toEqual([]);
  });
  it('accepts exactly 8 images and rejects 9', (): void => {
    const p = product();
    expect((): void => p.updateGallery(urls(8))).not.toThrow();
    expect((): void => p.updateGallery(urls(9))).toThrow(InvalidProductAttributeException);
    expect(p.getGalleryUrls()).toHaveLength(8);
  });
  it('rejects duplicate or blank images', (): void => {
    const p = product();
    expect((): void => p.updateGallery(['https://a.test/1.png', 'https://a.test/1.png'])).toThrow(
      InvalidProductAttributeException,
    );
    expect((): void => p.updateGallery([' '])).toThrow(InvalidProductAttributeException);
  });
  it('does not expose its internal array', (): void => {
    const p = product();
    p.updateGallery(urls(2));
    p.getGalleryUrls().push('mutated');
    expect(p.getGalleryUrls()).toHaveLength(2);
  });
  it('changeGallery keeps only retained URLs that already belong to the product, then appends', (): void => {
    const p = product();
    p.updateGallery(urls(3));
    p.changeGallery(
      [urls(3)[2], 'https://attacker.test/foreign.png'],
      ['https://example.test/new.png'],
    );
    expect(p.getGalleryUrls()).toEqual([urls(3)[2], 'https://example.test/new.png']);
    expect(p.getImageUrl()).toBe(urls(3)[2]);
  });
  it('changeGallery with null keeps everything and falls back to the legacy cover', (): void => {
    const p = product();
    p.updateImages('legacy', 'https://example.test/legacy.png');
    p.changeGallery(null, ['https://example.test/new.png']);
    expect(p.getGalleryUrls()).toEqual([
      'https://example.test/legacy.png',
      'https://example.test/new.png',
    ]);
  });
  it('changeGallery enforces the 8 image limit including retained images', (): void => {
    const p = product();
    p.updateGallery(urls(8));
    expect((): void => p.changeGallery(null, ['https://example.test/ninth.png'])).toThrow(
      InvalidProductAttributeException,
    );
    expect(p.getGalleryUrls()).toHaveLength(8);
  });
});
