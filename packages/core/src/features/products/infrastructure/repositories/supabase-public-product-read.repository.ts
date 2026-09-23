import { SupabaseClient } from '@supabase/supabase-js';
import { PublicProductReadRepositoryPort, PublicProductFilters } from '@/products/application/ports/out/public-product-read-repository.port';
import { PublicProductReadModel } from '@/products/application/read-models/public-product-read.model';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

export class SupabasePublicProductReadRepository implements PublicProductReadRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  async searchActiveByTenantSlug(
    tenantSlug: string,
    filters: PublicProductFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<PublicProductReadModel>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 24;

    const { data, error } = await this.supabase
      .rpc('get_public_products_by_slug', {
        p_tenant_slug: tenantSlug,
        p_category_slug: filters.categorySlug || null,
        p_search: filters.name ? this.escapeLike(filters.name.trim()) : null,
        p_page: page,
        p_limit: limit,
      });

    if (error) {
      throw new ProductRepositoryException(`Failed to search public products: ${error.message}`, error);
    }

    const items = (data || []).map((row: {
      id: string;
      name: string;
      price_cents: number;
      description: string | null;
      category_id: string;
      sku: string | null;
      image_url: string | null;
      has_variants: boolean;
      in_stock: boolean;
      total_count?: number;
    }) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      description: row.description,
      categoryId: row.category_id,
      sku: row.sku,
      imageUrl: row.image_url,
      hasVariants: row.has_variants,
      inStock: row.in_stock,
    }));

    const totalItems = data && data.length > 0 ? Number(data[0].total_count) : 0;

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}
