import { SupabaseClient } from '@supabase/supabase-js';
import { CategoryRepositoryException } from '@/categories/application/exceptions/category-repository.exception';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { CategoryFilters } from '@/categories/application/ports/out/category-repository.port';
import { CategoryStatus } from '@/categories/domain/enums/category-status.enum';

export interface CategoryReadModel {
  id: string;
  name: string;
  description: string;
  status: CategoryStatus;
  tenant_id: string;
  version: number;
}

export class SupabaseCategoryReadRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  async findById(id: string, tenantId: string): Promise<CategoryReadModel | null> {
    const { data, error } = await this.supabase
      .schema('catalog')
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        return null; // Not found
      }
      throw new CategoryRepositoryException(`Failed to read category: ${error?.message}`, error);
    }

    return data as CategoryReadModel;
  }

  async findAll(
    tenantId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<CategoryReadModel>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .schema('catalog')
      .from('categories')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(from, to);

    if (error)
      throw new CategoryRepositoryException(
        `Failed to get categories from this tenant: ${error.message}`,
        error,
      );

    const totalItems = count ?? 0;
    
    return {
      items: data as CategoryReadModel[],
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async searchByFilters(
    filters: CategoryFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<CategoryReadModel>> {
    let query = this.supabase
      .schema('catalog')
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

    if (error)
      throw new CategoryRepositoryException(`Failed to search categories: ${error.message}`, error);

    const totalItems = count ?? 0;

    return {
      items: data as CategoryReadModel[],
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}
