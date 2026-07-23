import { SupabaseClient } from '@supabase/supabase-js';
import { ProductRepositoryPort } from '@/products/application/ports/out/product-repository.port';
import { Product } from '@/products/domain/entities/product.entity';
import { SupabaseProductMapper } from '@/products/infrastructure/mappers/supabase-product.mapper';
import { DbProductRow } from '@/products/infrastructure/types/supabase-product.types';
import { ProductStatus } from '@/products/domain/enums/product-status.enum';
import { PaginationOptions, PaginatedResult } from '@/shared/domain/pagination/pagination';

export class SupabaseProductRepository implements ProductRepositoryPort {
  // Dependency Injection of Supabase Clients
  constructor(private readonly supabase: SupabaseClient) {}

  findBySku(sku: string, tenantId: number): Promise<Product | null> {
    throw new Error('Method not implemented.');
  }
  findAll(tenantId: number, pagination?: PaginationOptions): Promise<PaginatedResult<Product>> {
    throw new Error('Method not implemented.');
  }
  findByCategory(categoryId: string, tenantId: number): Promise<Product[]> {
    throw new Error('Method not implemented.');
  }
  findByStatus(status: ProductStatus, tenantId: number): Promise<Product[]> {
    throw new Error('Method not implemented.');
  }
  findAvailable(tenantId: number): Promise<Product[]> {
    throw new Error('Method not implemented.');
  }
  searchProductsByName(query: string, tenantId: number): Promise<Product[]> {
    throw new Error('Method not implemented.');
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
