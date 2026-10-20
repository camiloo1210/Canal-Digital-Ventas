import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActiveTenantContextReadModel,
  ActiveTenantContextReadPort,
} from '@/iam/application/ports/out/active-tenant-context-read.port';
import { TenantContextReadException } from '@/iam/application/exceptions/tenant-context-read.exception';

export class SupabaseActiveTenantContextReadAdapter implements ActiveTenantContextReadPort {
  constructor(private readonly client: SupabaseClient) {}

  async findForUser(userId: string): Promise<ActiveTenantContextReadModel> {
    try {
      const { data, error } = await this.client
        .schema('core')
        .from('tenant_memberships')
        .select('tenant_id, role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .returns<{ tenant_id: string; role: string }[]>();
      if (error) throw error;
      if (!data?.length) return { status: 'none' };
      if (data.length > 1) return { status: 'multiple' };
      const membership = data[0]!;
      const tenant = await this.client
        .schema('core')
        .from('tenants')
        .select('name, slug')
        .eq('id', membership.tenant_id)
        .single<{ name: string; slug: string }>();
      if (tenant.error || !tenant.data) throw tenant.error;
      return {
        status: 'ready',
        tenantId: membership.tenant_id,
        role: membership.role,
        tenantName: tenant.data.name,
        tenantSlug: tenant.data.slug,
      };
    } catch (error: unknown) {
      throw new TenantContextReadException(error);
    }
  }
}
