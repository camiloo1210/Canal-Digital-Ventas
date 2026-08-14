import { SupabaseClient } from '@supabase/supabase-js';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { Product } from '@/products/domain/entities/product.entity';
import { SupabaseProductMapper } from '@/products/infrastructure/mappers/supabase-product.mapper';
import { DbProductRow } from '@/products/infrastructure/types/supabase-product.types';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { ProductFilters } from '@/products/application/ports/out/product-repository.port';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';

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

    if (error) throw new Error(`Failed to search products: ${error.message}`);

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
    tenantId: number,
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

    if (error) throw new Error(`Failed to get products from this tenant: ${error.message}`);

    const totalItems = count ?? 0;
    const products = (data ?? []).map((row: DbProductRow) => SupabaseProductMapper.toDomain(row));

    return {
      items: products,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async searchProductsByName(query: string, tenantId: number): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${query}%`);

    if (error) throw new Error(`Failed to search products: ${error.message}`);

    return (data ?? []).map((row: DbProductRow) => SupabaseProductMapper.toDomain(row));
  }

  async findByCategoryId(categoryId: string, tenantId: number): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('tenant_id', tenantId)
      .eq('category_id', categoryId);

    if (error) throw new Error(`Failed to find products by category: ${error.message}`);

    return (data ?? []).map((row: DbProductRow) => SupabaseProductMapper.toDomain(row));
  }

  async findById(id: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error(error);
      return null;
    }

    return SupabaseProductMapper.toDomain(data as DbProductRow);
  }

  async save(product: Product): Promise<void> {
    const productData = SupabaseProductMapper.toPersistence(product);

    const { error: productError } = await this.supabase.from('products').upsert(productData);

    if (productError) {
      throw new Error(`Failed to save product: ${productError.message}`);
    }

    if (product.getHasVariants()) {
      const variantsData = product.getVariants().map((v) => ({
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

      const { error: variantError } = await this.supabase
        .from('product_variants')
        .upsert(variantsData);

      if (variantError) {
        throw new Error(`Failed to save variants: ${variantError.message}`);
      }
    }
  }

  async archive(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) throw new Error(`Failed to archive product: ${error.message}`);
  }

  async deleteById(id: string): Promise<void> {
    const { error } = await this.supabase.from('products').delete().eq('id', id);

    if (error) throw new Error(`Failed to delete product: ${error.message}`);
  }
}
