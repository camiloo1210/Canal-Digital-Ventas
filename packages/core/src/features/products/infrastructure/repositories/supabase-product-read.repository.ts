import { SupabaseClient } from '@supabase/supabase-js';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { ProductFilters } from '@/products/application/ports/out/product-repository.port';

export interface ProductReadModel {
  id: string;
  name: string;
  price_cents: number;
  cost_cents: number;
  wholesale_price_cents: number | null;
  description: string | null;
  stock: number;
  category_id: string;
  sku: string;
  status: import('@/products/domain/enums/product-status.enum').ProductStatus;
  tenant_id: string;
  is_vat_exempt: boolean;
  version: number;
  image_url: string | null;
}

export class SupabaseProductReadRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly isPublicContext: boolean = false
  ) {}

  private getTableName(): string {
    return this.isPublicContext ? 'public_active_products' : 'products';
  }

  async getProductForEdit(id: string, tenantId: string): Promise<ProductReadModel | null> {
    const { data, error } = await this.supabase
      .schema('catalog')
      .from(this.getTableName())
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        return null; // Not found
      }
      throw new ProductRepositoryException(`Failed to read product: ${error?.message}`, error);
    }

    return data as ProductReadModel;
  }

  async findAll(tenantId: string, pagination?: { page?: number; limit?: number }): Promise<{ items: ProductReadModel[]; totalItems: number; totalPages: number; currentPage: number }> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .schema('catalog')
      .from(this.getTableName())
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new ProductRepositoryException(`Failed to get products: ${error.message}`, error);
    }

    const totalItems = count ?? 0;
    return {
      items: (data ?? []) as ProductReadModel[],
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  async searchByFilters(
    filters: ProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ProductReadModel>> {
    let query = this.supabase
      .schema('catalog')
      .from(this.getTableName())
      .select('*', { count: 'exact' })
      .eq('tenant_id', filters.tenantId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }
    
    if (filters.name) {
      query = query.ilike('name', `%${this.escapeLike(filters.name)}%`);
    }

    if (filters.sku) {
      query = query.eq('sku', filters.sku);
    }

    // Deterministic ordering
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false });

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 24; // Default to 24 for the grid
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new ProductRepositoryException(`Failed to search products: ${error.message}`, error);
    }

    const totalItems = count ?? 0;
    return {
      items: (data ?? []) as ProductReadModel[],
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}
