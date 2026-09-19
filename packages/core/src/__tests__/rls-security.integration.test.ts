import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { PostgresTransactionManagerAdapter } from '@/shared/infrastructure/adapters/postgres-transaction-manager.adapter';
import { PostgresProductRepository } from '@/products/infrastructure/repositories/postgres-product.repository';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductName } from '@/products/domain/value-objects/product-name.vo';
import { createProductId } from '@/products/domain/types/product-id.type';
import { createTenantId } from '@/shared/domain/types/tenant-id.type';
import { Sku } from '@/products/domain/value-objects/sku.vo';
import { createCategoryId } from '@/products/domain/types/category-id.type';
import { Money } from '@/shared/domain/value-objects/money.vo';

const DATABASE_URL = process.env.DATABASE_URL;
const TENANT_A_ID = createTenantId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
const TENANT_B_ID = createTenantId('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

describe('RLS Cross-Tenant Security Integration', () => {
  let sql: postgres.Sql<Record<string, unknown>>;
  let transactionManager: PostgresTransactionManagerAdapter;
  let productRepository: PostgresProductRepository;

  beforeAll(async () => {
    if (!DATABASE_URL) {
      console.warn('DATABASE_URL is not set. Skipping real RLS tests.');
      return;
    }
    sql = postgres(DATABASE_URL);
    transactionManager = new PostgresTransactionManagerAdapter(sql);
    productRepository = new PostgresProductRepository(sql);
  });

  afterAll(async () => {
    if (sql) {
      await sql.end();
    }
  });

  it('should DENY Tenant A from updating a product belonging to Tenant B', async () => {
    if (!DATABASE_URL) return;

    const testProductId = createProductId('33333333-3333-3333-3333-333333333333');

    // Setup: Create a product belonging to TENANT_B (requires superuser or correct session context to insert)
    const initialProduct = Product.create(
      testProductId,
      ProductName.from('Tenant B Product'),
      Money.from(100),
      Money.from(50),
      'Desc',
      10,
      createCategoryId('cat-1'),
      Sku.from('TEST-B-SKU'),
      TENANT_B_ID,
      null,
      null,
      [],
      null,
      [],
      false,
      Money.from(0),
    );

    // Bypass RLS to seed data if needed or use TENANT_B context
    await transactionManager.runInTransaction(
      async (tx) => {
        await productRepository.save(initialProduct, tx);
      },
      { userId: TENANT_B_ID },
    );

    // Action: TENANT_A tries to read or update the product
    await transactionManager.runInTransaction(
      async (tx) => {
        const product = await productRepository.findById(testProductId, TENANT_A_ID, tx);
        expect(product).toBeNull(); // Should not be able to find it due to RLS/Tenant mismatch

        // Trying to update it anyway (simulating an attacker guessing the ID)
        initialProduct.changeDetails(
          ProductName.from('Hacked'),
          'Hacked',
          createCategoryId('cat-1'),
          Sku.from('HACK'),
          [],
          false,
        );

        // Attempting to save it. If RLS is strictly enforcing tenant_id, this should fail silently (0 rows updated) or throw permission denied
        await productRepository.save(initialProduct, tx);
      },
      { userId: TENANT_A_ID },
    );

    // Verify it wasn't changed
    await transactionManager.runInTransaction(
      async (tx) => {
        const product = await productRepository.findById(testProductId, TENANT_B_ID, tx);
        expect(product).not.toBeNull();
        expect(product?.getName()).toBe('Tenant B Product'); // Name should not be 'Hacked'
      },
      { userId: TENANT_B_ID },
    );

    // Cleanup
    await transactionManager.runInTransaction(
      async (tx) => {
        await productRepository.delete(testProductId, TENANT_B_ID, tx);
      },
      { userId: TENANT_B_ID },
    );
  });
});
