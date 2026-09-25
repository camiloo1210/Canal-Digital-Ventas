import type { SupabaseClient } from '@supabase/supabase-js';
import { PublicTenantDirectoryReadRepositoryPort } from '../../application/ports/out/public-tenant-directory-read-repository.port';
import { PublicTenantDirectoryResult } from '../../application/read-models/public-tenant-directory-item.model';
import { TenantRepositoryException } from '../../application/exceptions/tenant-repository.exception';

interface DbTenantDirectoryResult {
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  total_count: number;
}

export class SupabasePublicTenantDirectoryReadAdapter implements PublicTenantDirectoryReadRepositoryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async listActive(page: number, limit: number): Promise<PublicTenantDirectoryResult> {
    const { data, error } = await this.supabase
      .rpc('list_public_active_tenants_v2', { p_page: page, p_limit: limit });

    if (error) {
      throw new TenantRepositoryException(`Failed to list active tenants: ${error.message}`, error);
    }

    if (!data || data.length === 0) {
      return { items: [], total: 0, currentPage: page, totalPages: 0 };
    }

    const rows = data as DbTenantDirectoryResult[];
    const totalCount = rows[0].total_count;

    return {
      items: rows.map((t) => ({
        name: t.name,
        slug: t.slug,
        description: t.description,
        logoUrl: t.logo_url,
        bannerUrl: t.banner_url,
      })),
      total: totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }
}
