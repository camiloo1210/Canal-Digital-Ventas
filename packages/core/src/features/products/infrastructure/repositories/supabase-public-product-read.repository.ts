import { SupabaseClient } from '@supabase/supabase-js';
import {
  PublicProductReadRepositoryPort,
  PublicProductFilters,
} from '@/products/application/ports/out/public-product-read-repository.port';
import { PublicProductDetailReadModel } from '@/products/application/read-models/public-product-detail-read.model';
import {
  PublicProductReadModel,
  PublicStockAvailability,
} from '@/products/application/read-models/public-product-read.model';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';
import { PaginatedResult, PaginationOptions } from '@/shared/domain/pagination/pagination';

function toPublicStockAvailability(value: unknown): PublicStockAvailability {
  switch (value) {
    case 'AVAILABLE':
    case 'LOW_STOCK':
    case 'OUT_OF_STOCK':
    case 'CHECK_AVAILABILITY':
      return value;
    default:
      throw new ProductRepositoryException(
        `Invalid public stock availability returned from database: ${value}`,
      );
  }
}

function extractWholesaleRules(
  price: unknown,
  minQty: unknown,
): { price: number | null; minQty: number | null } {
  if (price === null && minQty === null) {
    return { price: null, minQty: null };
  }

  if (typeof price === 'number' && typeof minQty === 'number') {
    if (price > 0 && minQty >= 1 && Number.isInteger(price) && Number.isInteger(minQty)) {
      return { price, minQty };
    }
  }

  throw new ProductRepositoryException(
    `Invalid wholesale rules returned from database: price=${price}, minQty=${minQty}`,
  );
}

export class SupabasePublicProductReadRepository implements PublicProductReadRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  private escapeLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  async searchActiveByTenantSlug(
    tenantSlug: string,
    filters: PublicProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PublicProductReadModel>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 24;

    const { data, error } = await this.supabase.rpc('get_public_products_by_slug', {
      p_tenant_slug: tenantSlug,
      p_category_slug: filters.categorySlug || null,
      p_search: filters.name ? this.escapeLike(filters.name.trim()) : null,
      p_page: page,
      p_limit: limit,
    });

    if (error) {
      throw new ProductRepositoryException(
        `Failed to search public products: ${error.message}`,
        error,
      );
    }

    const items = (data || []).map(
      (row: {
        id: string;
        name: string;
        price_cents: number;
        description: string | null;
        category_id: string;
        sku: string | null;
        image_url: string | null;
        has_variants: boolean;
        in_stock: boolean;
        availability_status: unknown;
        total_count?: number;
        wholesale_price_cents: unknown;
        wholesale_min_quantity: unknown;
      }) => {
        const wholesale = extractWholesaleRules(
          row.wholesale_price_cents,
          row.wholesale_min_quantity,
        );
        return {
          id: row.id,
          name: row.name,
          priceCents: row.price_cents,
          description: row.description || '',
          categoryId: row.category_id,
          sku: row.sku || '',
          imageUrl: row.image_url,
          hasVariants: row.has_variants,
          inStock: row.in_stock,
          stockAvailability: toPublicStockAvailability(row.availability_status),
          wholesalePriceCents: wholesale.price,
          wholesaleMinQuantity: wholesale.minQty,
        };
      },
    );

    const totalItems = data && data.length > 0 ? Number(data[0].total_count) : 0;

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async findDetail(params: {
    tenantSlug: string;
    productId: string;
  }): Promise<PublicProductDetailReadModel | null> {
    const { data, error } = await this.supabase.rpc('get_public_product_by_id', {
      p_tenant_slug: params.tenantSlug,
      p_product_id: params.productId,
    });

    if (error) {
      throw new ProductRepositoryException(
        `Failed to fetch public product detail: ${error.message}`,
        error,
      );
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    const wholesale = extractWholesaleRules(row.wholesale_price_cents, row.wholesale_min_quantity);

    return {
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      description: row.description || '',
      categoryId: row.category_id || null,
      sku: row.sku || '',
      imageUrl: row.image_url || null,
      hasVariants: row.has_variants,
      inStock: row.in_stock,
      stockAvailability: toPublicStockAvailability(row.availability_status),
      wholesalePriceCents: wholesale.price,
      wholesaleMinQuantity: wholesale.minQty,
    };
  }
}
