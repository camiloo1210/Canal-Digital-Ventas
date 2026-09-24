import { SupabaseClient } from '@supabase/supabase-js';
import { PublicTenantReadRepositoryPort } from '../../application/ports/out/public-tenant-read-repository.port';
import { PublicTenantReadModel } from '../../application/read-models/public-tenant-read.model';

export class SupabasePublicTenantReadAdapter implements PublicTenantReadRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async findBySlug(slug: string): Promise<PublicTenantReadModel | null> {
    const { data, error } = await this.supabase
      .rpc('get_public_tenant_by_slug_v2', { p_tenant_slug: slug })
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        console.error(`Failed to resolve public tenant slug '${slug}':`, error);
      }
      return null;
    }

    type RpcReturnType = {
      name: string;
      slug: string;
      description: string | null;
      logo_url: string | null;
      banner_url: string | null;
    };
    
    const row = data as RpcReturnType;

    return {
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logo_url,
      bannerUrl: row.banner_url,
    };
  }
}
