import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { PostgresEventBusAdapter } from '@/shared/infrastructure/adapters/postgres-event-bus.adapter';
import { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';
import { TransactionException } from '@/shared/application/exceptions/transaction.exception';
const DATABASE_URL = process.env.DATABASE_URL;
const TEST_TENANT_ID = createTenantId('00000000-0000-0000-0000-000000000000'); // Assuming valid UUID

describe('PostgresTransactionManagerAdapter Integration', () => {
  let sql: postgres.Sql<Record<string, unknown>>;
  let transactionManager: PostgresTransactionManagerAdapter;
  let productRepository: PostgresProductRepository;
  let eventBus: PostgresEventBusAdapter;

  beforeAll(async () => {
    if (!DATABASE_URL) {
      console.warn('DATABASE_URL is not set. Skipping real integration tests.');
      return;
    }
    sql = postgres(DATABASE_URL);
    transactionManager = new PostgresTransactionManagerAdapter(sql);
    productRepository = new PostgresProductRepository(sql);
    eventBus = new PostgresEventBusAdapter();
  });

  afterAll(async () => {
    if (sql) {
      await sql.end();
    }
  });

  it('should completely ROLLBACK all changes if an exception is thrown inside the transaction block', async () => {
    if (!DATABASE_URL) return;

    const testProductId = createProductId('11111111-1111-1111-1111-111111111111');
    const originalName = 'Original Product';

    const initialProduct = Product.create(
      testProductId,
      ProductName.from(originalName),
      Money.from(100),
      Money.from(50),
      'Desc',
      10,
      createCategoryId('cat-1'),
      Sku.from('TEST-SKU-1'),
      TEST_TENANT_ID,
      null,
      null,
      [],
      null,
      [],
      false,
      Money.from(0),
    );
    await productRepository.save(initialProduct);

    try {
      await transactionManager.runInTransaction(
        async (tx) => {
          const productToUpdate = await productRepository.findById(
            testProductId,
            TEST_TENANT_ID,
            tx,
          );
          if (!productToUpdate) throw new Error('Not found');

          productToUpdate.changeDetails(
            ProductName.from('Updated Name'),
            'Updated Desc',
            createCategoryId('cat-1'),
            Sku.from('TEST-SKU-1'),
            [],
            false,
          );

          await productRepository.save(productToUpdate, tx);
          if (productToUpdate.domainEvents.length > 0) {
            const envelopes = productToUpdate.domainEvents.map((event) => ({
              event,
              context: {
                tenantId: TEST_TENANT_ID,
                aggregateType: 'Product',
                aggregateId: productToUpdate.getId(),
              },
            }));
            await eventBus.publish(envelopes, tx);
          }

          throw new TransactionException('Forced failure to trigger ROLLBACK');
        },
        { userId: TEST_TENANT_ID },
      );

      expect.fail('Transaction should have thrown an exception');
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionException);
      expect((error as Error).message).toContain('Forced failure to trigger ROLLBACK');
    }

    const productAfterRollback = await productRepository.findById(testProductId, TEST_TENANT_ID);
    expect(productAfterRollback).not.toBeNull();
    expect(productAfterRollback!.getName()).toBe(originalName);

    // Verify outbox was rolled back
    const outboxRows = await sql`SELECT * FROM core.outbox_events WHERE aggregate_id = ${testProductId}`;
    expect(outboxRows.length).toBe(0);

    await productRepository.delete(testProductId, TEST_TENANT_ID);
  });

  it('should COMMIT successfully if no exception occurs', async () => {
    if (!DATABASE_URL) return;

    const testProductId = createProductId('22222222-2222-2222-2222-222222222222');

    const initialProduct = Product.create(
      testProductId,
      ProductName.from('Old Name'),
      Money.from(100),
      Money.from(50),
      'Desc',
      10,
      createCategoryId('cat-1'),
      Sku.from('TEST-SKU-1'),
      TEST_TENANT_ID,
      null,
      null,
      [],
      null,
      [],
      false,
      Money.from(0),
    );
    await productRepository.save(initialProduct);

    await transactionManager.runInTransaction(
      async (tx) => {
        const productToUpdate = await productRepository.findById(testProductId, TEST_TENANT_ID, tx);
        if (!productToUpdate) throw new Error('Not found');

        productToUpdate.changeDetails(
          ProductName.from('New Name Committed'),
          'New Desc',
          createCategoryId('cat-1'),
          Sku.from('TEST-SKU-2'),
          [],
          false,
        );

        await productRepository.save(productToUpdate, tx);
      },
      { userId: TEST_TENANT_ID },
    );

    const productAfterCommit = await productRepository.findById(testProductId, TEST_TENANT_ID);
    expect(productAfterCommit).not.toBeNull();
    expect(productAfterCommit!.getName()).toBe('New Name Committed');
    expect(productAfterCommit!.getVersion()).toBe(2);

    await productRepository.delete(testProductId, TEST_TENANT_ID);
  });
});
