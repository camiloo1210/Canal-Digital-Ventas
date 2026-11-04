import { describe, expect, it, vi } from 'vitest';
import { CreateProductUseCase } from '@/products/application/use-cases/create-product.use-case';
import type { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import type { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import type { Category } from '@/categories/domain/entities/category.entity';
import { CategoryNotFoundException } from '@/categories/application/exceptions/category-not-found.exception';
import type { CreateProductDto } from '@/products/application/dtos/create-product.dto';
import type {
  TransactionContext,
  TransactionManagerPort,
} from '@/shared/application/ports/out/transaction-manager.port';

const TENANT = '750e8400-e29b-41d4-a716-446655440000';
const OTHER_TENANT = '850e8400-e29b-41d4-a716-446655440000';
const CATEGORY = '650e8400-e29b-41d4-a716-446655440000';

function setup(): {
  useCase: CreateProductUseCase;
  dto: CreateProductDto;
  save: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  findCategory: ReturnType<typeof vi.fn>;
  context: TransactionContext;
} {
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
  // The category belongs to TENANT only: any other tenant gets null, as the tenant-scoped query does.
  const findCategory = vi
    .fn()
    .mockImplementation(async (_id: string, tenantId: string): Promise<Category | null> =>
      tenantId === TENANT ? ({} as Category) : null,
    );
  const useCase = new CreateProductUseCase(
    { save } as unknown as ProductRepositoryPort,
    { findById: findCategory } as unknown as CategoryRepositoryPort,
    { publish },
    manager,
  );
  const dto: CreateProductDto = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: TENANT,
    categoryId: CATEGORY,
    name: 'Product',
    price: 10000,
    cost: 1000,
    wholesalePrice: null,
    wholesaleMinQuantity: null,
    description: '',
    sku: 'ABC123',
    stock: 5,
    seasonIds: [],
    isVatExempt: false,
  };
  return { useCase, dto, save, publish, findCategory, context };
}

describe('CreateProductUseCase category integrity', (): void => {
  it('saves the product when the category belongs to the tenant', async (): Promise<void> => {
    const test = setup();
    await test.useCase.execute(test.dto);
    expect(test.findCategory).toHaveBeenCalledWith(CATEGORY, TENANT, test.context);
    expect(test.save).toHaveBeenCalledTimes(1);
  });

  it('rejects a category of another tenant and saves nothing', async (): Promise<void> => {
    const test = setup();
    await expect(test.useCase.execute({ ...test.dto, tenantId: OTHER_TENANT })).rejects.toThrow(
      CategoryNotFoundException,
    );
    expect(test.save).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
  });
});
