import postgres from 'postgres';
import { CategoryRepositoryPort } from '@/categories/application/ports/out/category-repository.port';
import { Category } from '@/categories/domain/entities/category.entity';
import { CategoryRepositoryException } from '@/categories/application/exceptions/category-repository.exception';
import { CategoryId } from '@/categories/domain/types/category-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { TransactionContext } from '@/shared/application/ports/out/transaction-manager.port';
import { SupabaseCategoryMapper } from '@/categories/infrastructure/mappers/supabase-category.mapper';
import { DbCategoryRow } from '@/categories/infrastructure/types/supabase-category.types';
import { PaginatedResult } from '@/shared/domain/pagination/pagination';

export class PostgresCategoryRepository implements CategoryRepositoryPort {
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
    id: CategoryId,
    tenantId: TenantId,
    tx?: TransactionContext,
  ): Promise<Category | null> {
    try {
      return await this.executeSql(tx, async (conn) => {
        const rows = await conn`
          SELECT * FROM catalog.categories
          WHERE id = ${id} AND tenant_id = ${tenantId}
        `;

        if (rows.length === 0) return null;

        const categoryRow = rows[0] as unknown as DbCategoryRow;

        return SupabaseCategoryMapper.toDomain(categoryRow);
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CategoryRepositoryException(`Failed to find category: ${message}`, error);
    }
  }

  async save(category: Category, tx?: TransactionContext): Promise<void> {
    const categoryData = SupabaseCategoryMapper.toPersistence(category);

    try {
      await this.executeSql(tx, async (conn) => {
        await conn`
          INSERT INTO catalog.categories (
            id, tenant_id, name, slug, description, status, version
          ) VALUES (
            ${categoryData.id}, ${categoryData.tenant_id}, ${categoryData.name}, ${categoryData.slug},
            ${categoryData.description}, ${categoryData.status}, ${categoryData.version}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            version = EXCLUDED.version
          WHERE catalog.categories.tenant_id = EXCLUDED.tenant_id;
        `;
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' && 
        error !== null && 
        'code' in error && 
        (error as Record<string, unknown>).code === '23505' && 
        'constraint_name' in error &&
        (error as Record<string, unknown>).constraint_name === 'categories_tenant_id_slug_key'
      ) {
        const { CategorySlugAlreadyExistsException } = await import('@/categories/application/exceptions/category-slug-already-exists.exception');
        throw new CategorySlugAlreadyExistsException(categoryData.tenant_id, categoryData.slug);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CategoryRepositoryException(`Failed to save category: ${message}`, error);
    }
  }

  async deleteById(id: CategoryId, tenantId: TenantId, tx?: TransactionContext): Promise<void> {
    try {
      await this.executeSql(tx, async (conn) => {
        await conn`
          DELETE FROM catalog.categories
          WHERE id = ${id} AND tenant_id = ${tenantId}
        `;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CategoryRepositoryException(`Failed to delete category: ${message}`, error);
    }
  }

  async searchByFilters(): Promise<PaginatedResult<Category>> {
    throw new CategoryRepositoryException(
      'Method searchByFilters not implemented in write repository. Use ReadRepository.',
    );
  }

  async findAll(): Promise<PaginatedResult<Category>> {
    throw new CategoryRepositoryException(
      'Method findAll not implemented in write repository. Use ReadRepository.',
    );
  }

  async searchCategoriesByName(): Promise<Category[]> {
    throw new CategoryRepositoryException(
      'Method searchCategoriesByName not implemented in write repository. Use ReadRepository.',
    );
  }
}
