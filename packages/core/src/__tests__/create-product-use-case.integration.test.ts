import { PostgresProductCurrencyRepository } from '@/products/infrastructure/repositories/postgres-product-currency.repository';
import { createProductId } from '@/products/domain/types/product-id.type';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
import { PostgresCategoryRepository } from '@/categories/infrastructure/repositories/postgres-category.repository';
import { CreateProductUseCase } from '@/products/application/use-cases/create-product.use-case';
import { EventBusPort } from '@/shared/application/ports/out/event-bus.port';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionException } from '@/shared/application/exceptions/transaction.exception';
import { CreateProductDto } from '@/products/application/dtos/create-product.dto';
import {
  insertTestCategory,
  savepointSql,
  withRolledBackTenant,
} from '@/testing/integration/with-rolled-back-tenant';

const DATABASE_URL = process.env.DATABASE_URL;
const CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001';

describe.skipIf(!DATABASE_URL)(
  'CreateProductUseCase Integration (Transaction & Rollback)',
  (): void => {
    let sql: postgres.Sql<Record<string, unknown>>;

    beforeAll((): void => {
      sql = postgres(DATABASE_URL as string);
    });

    afterAll(async (): Promise<void> => {
      await sql.end();
    });

    const buildDto = (tenantId: string, productId: string, sku: string): CreateProductDto => ({
      id: productId,
      tenantId: createTenantId(tenantId),
      categoryId: CATEGORY_ID,
      name: 'Integration Product',
      price: 100,
      cost: 50,
      wholesalePrice: null,
      wholesaleMinQuantity: null,
      description: 'Test',
      sku,
      stock: 10,
      seasonIds: [],
      isVatExempt: false,
    });

    const buildUseCase = (
      scoped: postgres.Sql<Record<string, unknown>>,
      eventBus: EventBusPort,
    ): CreateProductUseCase =>
      new CreateProductUseCase(
        new PostgresProductRepository(scoped),
        new PostgresCategoryRepository(scoped),
        eventBus,
        new PostgresTransactionManagerAdapter(scoped),
        new PostgresProductCurrencyRepository(),
      );

    it('should completely ROLLBACK creation if an error occurs after saving', async (): Promise<void> => {
      await withRolledBackTenant(sql, async ({ tenantId, sql: tx }): Promise<void> => {
        const scoped = savepointSql(tx);
        await insertTestCategory(tx, tenantId, CATEGORY_ID);
        const failingBus: EventBusPort = {
          publish: (): Promise<void> =>
            Promise.reject(
              new TransactionException('Forced failure to trigger ROLLBACK during event publish'),
            ),
        };
        const productId = '11111111-1111-4111-8111-111111111111';

        let thrown: unknown;
        try {
          await buildUseCase(scoped, failingBus).execute(
            buildDto(tenantId, productId, 'ROLLBACK-SKU-1'),
          );
        } catch (error: unknown) {
          thrown = error;
        }

        expect(thrown).toBeInstanceOf(TransactionException);
        expect((thrown as Error).message).toContain('Forced failure to trigger ROLLBACK');

        const afterRollback = await new PostgresProductRepository(scoped).findById(
          createProductId(productId),
          createTenantId(tenantId),
        );
        expect(afterRollback).toBeNull();
      });
    });

    it('should COMMIT creation successfully if no error occurs', async (): Promise<void> => {
      await withRolledBackTenant(sql, async ({ tenantId, sql: tx }): Promise<void> => {
        const scoped = savepointSql(tx);
        await insertTestCategory(tx, tenantId, CATEGORY_ID);
        const noopBus: EventBusPort = { publish: (): Promise<void> => Promise.resolve() };
        const productId = '22222222-2222-4222-8222-222222222222';

        const returnedId = await buildUseCase(scoped, noopBus).execute(
          buildDto(tenantId, productId, 'COMMIT-SKU-1'),
        );
        expect(returnedId).toBe(productId);

        const stored = await new PostgresProductRepository(scoped).findById(
          createProductId(productId),
          createTenantId(tenantId),
        );
        expect(stored).not.toBeNull();
        expect(stored?.getName()).toBe('Integration Product');
      });
    });
  },
);
