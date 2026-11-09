import { Currency } from '@/shared/domain/enums/currency.enum';
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
import {
  insertTestCategory,
  savepointSql,
  withRolledBackTenant,
} from '@/testing/integration/with-rolled-back-tenant';

const DATABASE_URL = process.env.DATABASE_URL;
const CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001';
const ACTOR_ID = 'a0000000-0000-4000-8000-000000000001';

describe.skipIf(!DATABASE_URL)('PostgresTransactionManagerAdapter Integration', (): void => {
  let sql: postgres.Sql<Record<string, unknown>>;

  beforeAll((): void => {
    sql = postgres(DATABASE_URL as string);
  });

  afterAll(async (): Promise<void> => {
    await sql.end();
  });

  const newProduct = (productId: string, tenantId: string, name: string): Product =>
    Product.create(
      createProductId(productId),
      ProductName.from(name),
      Money.from(100, Currency.USD),
      Money.from(50, Currency.USD),
      'Desc',
      10,
      createCategoryId(CATEGORY_ID),
      Sku.from('TEST-SKU-1'),
      createTenantId(tenantId),
      null,
      null,
      [],
      null,
      [],
      false,
      Money.from(0, Currency.USD),
      null,
    );

  it('should completely ROLLBACK all changes if an exception is thrown inside the transaction block', async (): Promise<void> => {
    await withRolledBackTenant(sql, async ({ tenantId, sql: tx }): Promise<void> => {
      // The manager opens a SAVEPOINT inside the disposable outer transaction.
      const scoped = savepointSql(tx);
      const transactionManager = new PostgresTransactionManagerAdapter(scoped);
      const productRepository = new PostgresProductRepository(scoped);
      const eventBus = new PostgresEventBusAdapter();
      const tenant = createTenantId(tenantId);
      const productId = createProductId('11111111-1111-4111-8111-111111111111');
      await insertTestCategory(tx, tenantId, CATEGORY_ID);
      await productRepository.save(newProduct(productId, tenantId, 'Original Product'));

      let thrown: unknown;
      try {
        await transactionManager.runInTransaction(
          async (context): Promise<void> => {
            const productToUpdate = await productRepository.findById(productId, tenant, context);
            if (!productToUpdate) throw new Error('Not found');

            productToUpdate.changeDetails(
              ProductName.from('Updated Name'),
              'Updated Desc',
              createCategoryId(CATEGORY_ID),
              Sku.from('TEST-SKU-1'),
              [],
              false,
            );

            await productRepository.save(productToUpdate, context);
            await eventBus.publish(
              productToUpdate.domainEvents.map((event) => ({
                event,
                context: {
                  tenantId: tenant,
                  aggregateType: 'Product',
                  aggregateId: productToUpdate.getId(),
                },
              })),
              context,
            );

            throw new TransactionException('Forced failure to trigger ROLLBACK');
          },
          { userId: ACTOR_ID },
        );
      } catch (error: unknown) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(TransactionException);
      expect((thrown as Error).message).toContain('Forced failure to trigger ROLLBACK');

      const productAfterRollback = await productRepository.findById(productId, tenant);
      expect(productAfterRollback).not.toBeNull();
      expect(productAfterRollback?.getName()).toBe('Original Product');

      const outboxRows = await tx`
        SELECT id FROM core.outbox_events WHERE aggregate_id = ${productId}
      `;
      expect(outboxRows).toHaveLength(0);
    });
  });

  it('should COMMIT successfully if no exception occurs', async (): Promise<void> => {
    await withRolledBackTenant(sql, async ({ tenantId, sql: tx }): Promise<void> => {
      const scoped = savepointSql(tx);
      const transactionManager = new PostgresTransactionManagerAdapter(scoped);
      const productRepository = new PostgresProductRepository(scoped);
      const tenant = createTenantId(tenantId);
      const productId = createProductId('22222222-2222-4222-8222-222222222222');
      await insertTestCategory(tx, tenantId, CATEGORY_ID);
      await productRepository.save(newProduct(productId, tenantId, 'Old Name'));

      await transactionManager.runInTransaction(
        async (context): Promise<void> => {
          const productToUpdate = await productRepository.findById(productId, tenant, context);
          if (!productToUpdate) throw new Error('Not found');

          productToUpdate.changeDetails(
            ProductName.from('New Name Committed'),
            'New Desc',
            createCategoryId(CATEGORY_ID),
            Sku.from('TEST-SKU-2'),
            [],
            false,
          );

          await productRepository.save(productToUpdate, context);
        },
        { userId: ACTOR_ID },
      );

      const productAfterCommit = await productRepository.findById(productId, tenant);
      expect(productAfterCommit).not.toBeNull();
      expect(productAfterCommit?.getName()).toBe('New Name Committed');
      expect(productAfterCommit?.getVersion()).toBe(1);
    });
  });
});
