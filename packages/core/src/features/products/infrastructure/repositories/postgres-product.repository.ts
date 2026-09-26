import postgres from 'postgres';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { Product } from '@/products/domain/entities/product.entity';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
import { ProductId } from '@/products/domain/types/product-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { SupabaseProductMapper } from '@/products/infrastructure/mappers/supabase-product.mapper';
import { DbProductRow } from '@/products/infrastructure/types/supabase-product.types';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';

export class PostgresProductRepository implements ProductRepositoryPort {
  constructor(private readonly sql: postgres.Sql<Record<string, unknown>>) {}

  private async executeSql<T>(
    tx: TransactionContext | undefined,
    operation: (conn: postgres.Sql<Record<string, unknown>> | postgres.TransactionSql<Record<string, unknown>>) => Promise<T>
  ): Promise<T> {
    if (tx) {
      return tx.executeNative<postgres.TransactionSql<Record<string, unknown>>, T>(operation);
    }
    return operation(this.sql);
  }

  async findById(
    id: ProductId,
    tenantId: TenantId,
    tx?: TransactionContext,
  ): Promise<Product | null> {
    try {
      return await this.executeSql(tx, async (conn) => {
        const rows = await conn`
          SELECT * FROM catalog.products
          WHERE id = ${id} AND tenant_id = ${tenantId}
        `;

        if (rows.length === 0) return null;

        const productRow = rows[0] as unknown as DbProductRow;
        productRow.product_variants = [];

        return SupabaseProductMapper.toDomain(productRow);
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ProductRepositoryException(`Failed to find product: ${message}`, error);
    }
  }

  async save(product: Product, tx?: TransactionContext): Promise<void> {
    const productData = SupabaseProductMapper.toPersistence(product);

    try {
      await this.executeSql(tx, async (conn) => {
        await conn`
          INSERT INTO catalog.products (
            id, tenant_id, category_id, name, description, sku, price_cents, cost_cents,
            wholesale_price_cents, stock, is_vat_exempt, status, version, updated_at,
            image_path, image_url
          ) VALUES (
            ${productData.id}, ${productData.tenant_id}, ${productData.category_id}, ${productData.name},
            ${productData.description}, ${productData.sku}, ${productData.price_cents}, ${productData.cost_cents},
            ${productData.wholesale_price_cents}, ${productData.stock}, ${productData.is_vat_exempt},
            ${productData.status}, ${productData.version}, ${productData.updated_at}, ${productData.image_path}, ${productData.image_url}
          )
          ON CONFLICT (id) DO UPDATE SET
            category_id = EXCLUDED.category_id,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            sku = EXCLUDED.sku,
            price_cents = EXCLUDED.price_cents,
            cost_cents = EXCLUDED.cost_cents,
            wholesale_price_cents = EXCLUDED.wholesale_price_cents,
            stock = EXCLUDED.stock,
            is_vat_exempt = EXCLUDED.is_vat_exempt,
            status = EXCLUDED.status,
            version = EXCLUDED.version,
            updated_at = EXCLUDED.updated_at,
            image_path = EXCLUDED.image_path,
            image_url = EXCLUDED.image_url
          WHERE catalog.products.tenant_id = EXCLUDED.tenant_id;
        `;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ProductRepositoryException(`Failed to save product: ${message}`, error);
    }
  }

  async delete(id: ProductId, tenantId: TenantId, tx?: TransactionContext): Promise<void> {
    try {
      await this.executeSql(tx, async (conn) => {
        await conn`
          DELETE FROM catalog.products
          WHERE id = ${id} AND tenant_id = ${tenantId}
        `;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ProductRepositoryException(`Failed to delete product: ${message}`, error);
    }
  }

  async searchByFilters(): Promise<PaginatedResult<Product>> {
    throw new ProductRepositoryException(
      'Method searchByFilters not implemented in write repository. Use ReadRepository.',
    );
  }

  async findAll(): Promise<PaginatedResult<Product>> {
    throw new ProductRepositoryException(
      'Method findAll not implemented in write repository. Use ReadRepository.',
    );
  }

  async searchProductsByName(): Promise<Product[]> {
    throw new ProductRepositoryException(
      'Method searchProductsByName not implemented in write repository. Use ReadRepository.',
    );
  }

  async findByCategoryId(): Promise<Product[]> {
    throw new ProductRepositoryException(
      'Method findByCategoryId not implemented in write repository. Use ReadRepository.',
    );
  }
}
