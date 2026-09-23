import { createProductId } from '@/products/domain/types/product-id.type';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import postgres from 'postgres';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
import { CreateProductUseCase } from '@/products/application/use-cases/create-product.use-case';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionException } from '@/shared/application/exceptions/transaction.exception';
import { CreateProductDto } from '@/products/application/dtos/create-product.dto';

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_TENANT_ID = createTenantId('00000000-0000-0000-0000-000000000000');

describe('CreateProductUseCase Integration (Transaction & Rollback)', () => {
  let sql: postgres.Sql<Record<string, unknown>>;
  let transactionManager: PostgresTransactionManagerAdapter;
  let productRepository: PostgresProductRepository;
  let eventBus: EventBusPort;
  let useCase: CreateProductUseCase;

  beforeAll(async () => {
    if (!DATABASE_URL) {
      console.warn('DATABASE_URL is not set. Skipping real integration tests.');
      return;
    }
    sql = postgres(DATABASE_URL);
    transactionManager = new PostgresTransactionManagerAdapter(sql);
    productRepository = new PostgresProductRepository(sql);
    eventBus = { publish: vi.fn() };
    useCase = new CreateProductUseCase(productRepository, eventBus, transactionManager);
  });

  afterAll(async () => {
    if (sql) {
      await sql.end();
    }
  });

  it('should completely ROLLBACK creation if an error occurs after saving', async () => {
    if (!DATABASE_URL) return;

    const testProductId = crypto.randomUUID();
    const dto: CreateProductDto = {
      id: testProductId,
      tenantId: TEST_TENANT_ID,
      categoryId: crypto.randomUUID(),
      name: 'Rollback Test Product',
      price: 100,
      cost: 50,
      wholesalePrice: null,
      description: 'Test',
      sku: 'ROLLBACK-SKU-1',
      stock: 10,
      seasonIds: [],
      isVatExempt: false,
    };

    const publishSpy = vi.spyOn(eventBus, 'publish').mockImplementationOnce(async () => {
      throw new TransactionException('Forced failure to trigger ROLLBACK during event publish');
    });

    try {
      await useCase.execute(dto);
      expect.fail('UseCase should have thrown an exception');
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionException);
      expect((error as Error).message).toContain('Forced failure to trigger ROLLBACK');
    }

    const productAfterRollback = await productRepository.findById(createProductId(testProductId), TEST_TENANT_ID);
    expect(productAfterRollback).toBeNull();
    
    publishSpy.mockRestore();
  });

  it('should COMMIT creation successfully if no error occurs', async () => {
    if (!DATABASE_URL) return;

    const testProductId = crypto.randomUUID();
    const dto: CreateProductDto = {
      id: testProductId,
      tenantId: TEST_TENANT_ID,
      categoryId: crypto.randomUUID(),
      name: 'Commit Test Product',
      price: 100,
      cost: 50,
      wholesalePrice: null,
      description: 'Test',
      sku: 'COMMIT-SKU-1',
      stock: 10,
      seasonIds: [],
      isVatExempt: false,
    };

    const returnedId = await useCase.execute(dto);
    expect(returnedId).toBe(testProductId);

    const productAfterCommit = await productRepository.findById(createProductId(testProductId), TEST_TENANT_ID);
    expect(productAfterCommit).not.toBeNull();
    expect(productAfterCommit!.getName()).toBe('Commit Test Product');

    await productRepository.delete(createProductId(testProductId), TEST_TENANT_ID);
  });
});
