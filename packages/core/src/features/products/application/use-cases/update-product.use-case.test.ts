import { describe, expect, it, vi } from 'vitest';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
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
import { InvalidWholesaleRulesException } from '@/products/domain/exceptions/invalid-wholesale-rules.exception';

function setup(): {
  product: Product;
  useCase: UpdateProductUseCase;
  dto: UpdateProductDto;
  save: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  context: TransactionContext;
} {
  const product = Product.create(
    createProductId('550e8400-e29b-41d4-a716-446655440000'),
    ProductName.from('Original'),
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
    'old/path.png',
    [],
    false,
    Money.from(7000),
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
  const useCase = new UpdateProductUseCase(repository, { publish }, manager);
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
  return { product, useCase, dto, save, publish, context };
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
});
