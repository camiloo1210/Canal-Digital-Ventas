import { SupabaseClient } from '@supabase/supabase-js';
import { ProductRepositoryException } from '@/products/application/exceptions/product-repository.exception';

export interface ProductReadModel {
  id: string;
  name: string;
  price: number;
  cost: number;
  wholesale_price: number | null;
  description: string | null;
  stock: number;
  category_id: string;
  sku: string;
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
}
