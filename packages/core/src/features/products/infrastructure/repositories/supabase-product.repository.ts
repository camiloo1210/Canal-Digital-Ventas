import { SupabaseClient } from '@supabase/supabase-js';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { Product } from '@/products/domain/entities/product.entity';
import { SupabaseProductMapper } from '@/products/infrastructure/mappers/supabase-product.mapper';
import { DbProductRow } from '@/products/infrastructure/types/supabase-product.types';

import { ProductFilters } from '@/products/application/ports/out/product-repository.port';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';
import { ProductId } from '@/products/domain/types/product-id.type';
import { CategoryId } from '@/products/domain/types/category-id.type';
import { TenantId } from '@/shared/domain/types/tenant-id.type';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';

export class SupabaseProductRepository implements ProductRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async searchByFilters(
    filters: ProductFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Product>> {
    let query = this.supabase
      .from('products')
      .select('*, product_variants(*)', { count: 'exact' })
      .eq('tenant_id', filters.tenantId);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.sku) query = query.eq('sku', filters.sku);
    if (filters.name) query = query.ilike('name', `%${filters.name}%`);
    if (filters.id) query = query.eq('id', filters.id);

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new ProductRepositoryException(`Failed to search products: ${error.message}`, error);
    }

    const totalItems = count ?? 0;
    const products = (data ?? []).map((row: DbProductRow) => SupabaseProductMapper.toDomain(row));

    return {
      items: products,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async findAll(
    tenantId: TenantId,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Product>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('products')
      .select('*, product_variants(*)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(from, to);

    if (error) {
      throw new ProductRepositoryException(
        `Failed to get products from this tenant: ${error.message}`,
        error,
      );
    }

    const totalItems = count ?? 0;
    const products = (data ?? []).map((row: DbProductRow) => SupabaseProductMapper.toDomain(row));

    return {
      items: products,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async searchProductsByName(query: string, tenantId: TenantId): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${query}%`);

    if (error) {
      throw new ProductRepositoryException(`Failed to search products: ${error.message}`, error);
    }

    return (data ?? []).map((row: DbProductRow) => SupabaseProductMapper.toDomain(row));
  }

  async findByCategoryId(categoryId: CategoryId, tenantId: TenantId): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('tenant_id', tenantId)
      .eq('category_id', categoryId);

    if (error) {
      throw new ProductRepositoryException(
        `Failed to find products by category: ${error.message}`,
        error,
      );
    }

    return (data ?? []).map((row: DbProductRow) => SupabaseProductMapper.toDomain(row));
  }

  async findById(id: ProductId, tenantId: TenantId): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId) // Ensure tenantId is checked at db level
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        console.error(error);
      }
      return null;
    }

    return SupabaseProductMapper.toDomain(data as DbProductRow);
  }

  async save(product: Product): Promise<void> {
    const productData = SupabaseProductMapper.toPersistence(product);
    let variantsData: Record<string, unknown>[] = [];

    if (product.getHasVariants()) {
      variantsData = product.getVariants().map((v) => ({
        id: v.getId(),
        product_id: v.getProductId(),
        sku: v.getSku(),
        name: v.getName(),
        attributes: v.getAttributes(),
        price_override_cents: v.getPriceOverride()
          ? Math.round(v.getPriceOverride()!.getValue() * 100)
          : null,
        stock: v.getStock(),
        status: v.getStatus(),
      }));
    }

    const { error } = await this.supabase.rpc('upsert_product_transactional', {
      product_data: productData,
      variants_data: variantsData,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new ProductRepositoryException(
          `Optimistic locking failed: the product has been updated by another transaction.`,
          error,
        );
      }
      throw new ProductRepositoryException(
        `Failed to save product transactionally: ${error.message}`,
        error,
      );
    }
  }

  async delete(id: ProductId, tenantId: TenantId): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new ProductRepositoryException(`Failed to delete product: ${error.message}`, error);
    }
  }
}
