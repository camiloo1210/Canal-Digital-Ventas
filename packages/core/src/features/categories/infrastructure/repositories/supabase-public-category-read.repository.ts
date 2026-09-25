import { SupabaseClient } from '@supabase/supabase-js';
import { PublicCategoryReadRepositoryPort } from '@/categories/application/ports/out/public-category-read-repository.port';
import { PublicCategoryReadModel } from '@/categories/application/read-models/public-category-read.model';
import { CategoryRepositoryException } from '@/categories/application/exceptions/category-repository.exception';

export class SupabasePublicCategoryReadRepository implements PublicCategoryReadRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async searchActiveByTenantSlug(tenantSlug: string): Promise<PublicCategoryReadModel[]> {
    const { data, error } = await this.supabase
      .rpc('get_public_categories_by_slug', { p_tenant_slug: tenantSlug });

    if (error) {
      throw new CategoryRepositoryException(
        `Failed to get public categories: ${error.message}`,
        error
      );
    }

    return (data || []).map((row: { slug: string; name: string; description: string | null }) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
    }));
  }
}
