import { Currency } from '@/shared/domain/enums/currency.enum';
import { describe, expect, it, vi } from 'vitest';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { PackageData } from '@/products/domain/value-objects/package-data.vo';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { UpdateProductUseCase } from '@/products/application/use-cases/update-product.use-case';
import type { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import type { UpdateProductDto } from '@/products/application/dtos/update-product.dto';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';
import type { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import type { Category } from '@/categories/domain/entities/category.entity';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import { InvalidWholesaleRulesException } from '@/products/domain/exceptions/invalid-wholesale-rules.exception';

function setup(): {
  product: Product;
  useCase: UpdateProductUseCase;
  dto: UpdateProductDto;
  save: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  findCategory: ReturnType<typeof vi.fn>;
  context: TransactionContext;
} {
  const product = Product.create(
    createProductId('550e8400-e29b-41d4-a716-446655440000'),
    ProductName.from('Original'),
    Money.from(10000, Currency.USD),
    Money.from(1000, Currency.USD),
    '',
    10,
    createCategoryId('650e8400-e29b-41d4-a716-446655440000'),
    Sku.from('ABC123'),
    createTenantId('750e8400-e29b-41d4-a716-446655440000'),
    null,
    null,
    [],
    'old/path.png',
    [],
    false,
    Money.from(7000, Currency.USD),
    37,
  );
  product.updateImages('old/path.png', 'https://example.test/old.png');
  product.clearDomainEvents();
  const save = vi.fn().mockResolvedValue(undefined);
  const publish = vi.fn().mockResolvedValue(undefined);
  const context: TransactionContext = {
    executeNative: async <TConnection, TResult>(
      callback: (conn: TConnection) => Promise<TResult>,
    ): Promise<TResult> => callback({} as TConnection),
  };
  const manager: TransactionManagerPort = {
    runInTransaction: async <T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> =>
      operation(context),
  };
  const repository = {
    findById: vi.fn().mockResolvedValue(product),
    save,
  } as unknown as ProductRepositoryPort;
  const TENANT = product.getTenantId();
  const findCategory = vi
    .fn()
    .mockImplementation(async (_id: string, tenantId: string): Promise<Category | null> =>
      tenantId === TENANT ? ({} as Category) : null,
    );
  const categories = { findById: findCategory } as unknown as CategoryRepositoryPort;
  const useCase = new UpdateProductUseCase(repository, categories, { publish }, manager);
  const dto: UpdateProductDto = {
    productId: product.getId(),
    tenantId: product.getTenantId(),
    expectedVersion: product.getVersion(),
    name: 'Updated',
    sku: 'ABC123',
    price: 10105,
    cost: 1000,
    wholesalePrice: 7000,
    wholesaleMinQuantity: 37,
    categoryId: '650e8400-e29b-41d4-a716-446655440000',
    stock: 10,
    seasonIds: [],
    isVatExempt: false,
  };
  return { product, useCase, dto, save, publish, findCategory, context };
}

describe('product edit transaction', (): void => {
  it('preserves existing wholesale minimum and image while updating another field', async (): Promise<void> => {
    const test = setup();
    await test.useCase.execute(test.dto);
    expect(test.product.getWholesaleMinQuantity()).toBe(37);
    expect(test.product.getImageUrl()).toBe('https://example.test/old.png');
    expect(test.save).toHaveBeenCalledWith(test.product, test.context);
    expect(test.publish).toHaveBeenCalledWith(expect.any(Array), test.context);
  });
  it('saves an image replacement with other changes in the same transaction', async (): Promise<void> => {
    const test = setup();
    await test.useCase.execute({
      ...test.dto,
      imagePath: 'new/path.png',
      imageUrl: 'https://example.test/new.png',
    });
    expect(test.product.getImagePath()).toBe('new/path.png');
    expect(test.product.getWholesaleMinQuantity()).toBe(37);
    expect(test.save).toHaveBeenCalledTimes(1);
    expect(test.save).toHaveBeenCalledWith(test.product, test.context);
  });
  it('keeps wholesale validation authoritative in Core and never saves invalid pairs', async (): Promise<void> => {
    const test = setup();
    await expect(test.useCase.execute({ ...test.dto, wholesaleMinQuantity: 0 })).rejects.toThrow(
      InvalidWholesaleRulesException,
    );
    expect(test.save).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
  });
  it('does not replace images or persist changes on stale versions', async (): Promise<void> => {
    const test = setup();
    await expect(
      test.useCase.execute({
        ...test.dto,
        expectedVersion: 0,
        imagePath: 'new',
        imageUrl: 'https://example.test/new.png',
      }),
    ).rejects.toThrow();
    expect(test.product.getImageUrl()).toBe('https://example.test/old.png');
    expect(test.save).not.toHaveBeenCalled();
  });
  it('rejects a category that does not exist for the tenant and saves nothing', async (): Promise<void> => {
    const test = setup();
    test.findCategory.mockResolvedValue(null);
    await expect(test.useCase.execute(test.dto)).rejects.toThrow(CategoryNotFoundException);
    expect(test.findCategory).toHaveBeenCalledWith(
      test.dto.categoryId,
      test.dto.tenantId,
      test.context,
    );
    expect(test.save).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
  });
});

describe('UpdateProductUseCase package data', (): void => {
  const existing = {
    weightGrams: 500,
    lengthMm: 300,
    widthMm: 200,
    heightMm: 100,
  };

  function withExisting(): ReturnType<typeof setup> {
    const test = setup();
    test.product.changePackageData(PackageData.create(existing));
    test.dto.expectedVersion = test.product.getVersion();
    return test;
  }

  it('keeps the existing package data when packageData is undefined', async (): Promise<void> => {
    const test = withExisting();
    await test.useCase.execute(test.dto);
    const saved = test.save.mock.calls[0][0] as Product;
    expect(saved.getPackageData()?.weightGrams).toBe(500);
    expect(saved.getPackageData()?.heightMm).toBe(100);
  });

  it('clears the package data when packageData is null', async (): Promise<void> => {
    const test = withExisting();
    await test.useCase.execute({ ...test.dto, packageData: null });
    const saved = test.save.mock.calls[0][0] as Product;
    expect(saved.getPackageData()).toBeNull();
  });

  it('replaces the package data when an object is given', async (): Promise<void> => {
    const test = withExisting();
    await test.useCase.execute({
      ...test.dto,
      packageData: { weightGrams: 900, lengthMm: 10, widthMm: 20, heightMm: 30 },
    });
    const saved = test.save.mock.calls[0][0] as Product;
    expect(saved.getPackageData()?.weightGrams).toBe(900);
    expect(saved.getPackageData()?.lengthMm).toBe(10);
    expect(saved.getPackageData()?.widthMm).toBe(20);
    expect(saved.getPackageData()?.heightMm).toBe(30);
  });
});
