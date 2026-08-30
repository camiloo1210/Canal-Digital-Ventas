import { SupabaseClient } from '@supabase/supabase-js';
import {
  CategoryRepositoryPort,
  CategoryFilters,
} from '@/categories/application/ports/out/category-repository.port';
import { Category } from '@/categories/domain/entities/category.entity';
import { SupabaseCategoryMapper } from '@/categories/infrastructure/mappers/supabase-category.mapper';
import { DbCategoryRow } from '@/categories/infrastructure/types/supabase-category.types';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { TenantId } from '@/categories/domain/types/tenant-id.type';
import { CategoryId } from '@/categories/domain/types/category-id.type';
export class SupabaseCategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  async searchByFilters(
    filters: CategoryFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Category>> {
    let query = this.supabase
      .from('categories')
      .select('*', { count: 'exact' })
      .eq('tenant_id', filters.tenantId);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.name) query = query.ilike('name', `%${this.escapeLike(filters.name)}%`);
    if (filters.id) query = query.eq('id', filters.id);

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to search categories: ${error.message}`);

    const totalItems = count ?? 0;
    const categories = (data ?? []).map((row: DbCategoryRow) =>
      SupabaseCategoryMapper.toDomain(row),
    );

    return {
      items: categories,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Category>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('categories')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(from, to);

    if (error) throw new Error(`Failed to get categories from this tenant: ${error.message}`);

    const totalItems = count ?? 0;
    const categories = (data ?? []).map((row: DbCategoryRow) =>
      SupabaseCategoryMapper.toDomain(row),
    );

    return {
      items: categories,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async searchCategoriesByName(query: string, tenantId: TenantId): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${this.escapeLike(query)}%`);

    if (error) throw new Error(`Failed to search categories: ${error.message}`);

    return (data ?? []).map((row: DbCategoryRow) => SupabaseCategoryMapper.toDomain(row));
  }

  async findById(id: CategoryId, tenantId: TenantId): Promise<Category | null> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      console.error(error);
      return null;
    }

    return SupabaseCategoryMapper.toDomain(data as DbCategoryRow);
  }

  async save(category: Category): Promise<void> {
    const categoryData = SupabaseCategoryMapper.toPersistence(category);

    const { error: categoryError } = await this.supabase.from('categories').upsert(categoryData);

    if (categoryError) {
      throw new Error(`Failed to save category: ${categoryError.message}`);
    }
  }

  async deleteById(id: CategoryId, tenantId: TenantId): Promise<void> {
    const { error } = await this.supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`Failed to delete category: ${error.message}`);
  }
}
