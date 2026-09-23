import { SupabaseClient } from '@supabase/supabase-js';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';

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
  constructor(private readonly supabase: SupabaseClient) {}

  async getProductForEdit(id: string, tenantId: string): Promise<ProductReadModel | null> {
    const { data, error } = await this.supabase
      .schema('catalog')
      .from('products')
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
      .from('products')
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
}
