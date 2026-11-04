import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActiveMembershipSummary,
  ActiveTenantReadyContext,
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

  async findAllActiveForUser(userId: string): Promise<ActiveMembershipSummary[]> {
    try {
      const { data, error } = await this.client
        .schema('core')
        .from('tenant_memberships')
        .select('tenant_id, role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .returns<{ tenant_id: string; role: string }[]>();
      if (error) throw error;
      if (!data?.length) return [];
      const tenants = await this.client
        .schema('core')
        .from('tenants')
        .select('id, name, slug')
        .in(
          'id',
          data.map((row): string => row.tenant_id),
        )
        .returns<{ id: string; name: string; slug: string }[]>();
      if (tenants.error) throw tenants.error;
      const byId = new Map(
        (tenants.data ?? []).map(
          (row): readonly [string, { id: string; name: string; slug: string }] => [row.id, row],
        ),
      );
      const summaries: ActiveMembershipSummary[] = [];
      for (const membership of data) {
        const tenant = byId.get(membership.tenant_id);
        if (!tenant) continue;
        summaries.push({
          tenantId: membership.tenant_id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          role: membership.role,
        });
      }
      return summaries.sort((a, b): number => a.tenantName.localeCompare(b.tenantName));
    } catch (error: unknown) {
      throw new TenantContextReadException(error);
    }
  }

  async resolveForUser(userId: string, tenantId: string): Promise<ActiveTenantReadyContext | null> {
    try {
      const { data, error } = await this.client
        .schema('core')
        .from('tenant_memberships')
        .select('tenant_id, role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('tenant_id', tenantId)
        .returns<{ tenant_id: string; role: string }[]>();
      if (error) throw error;
      const membership = data?.[0];
      if (!membership) return null;
      const tenants = await this.client
        .schema('core')
        .from('tenants')
        .select('id, name, slug')
        .eq('id', tenantId)
        .returns<{ id: string; name: string; slug: string }[]>();
      if (tenants.error) throw tenants.error;
      const tenant = tenants.data?.[0];
      if (!tenant) return null;
      return {
        status: 'ready',
        tenantId: membership.tenant_id,
        role: membership.role,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
      };
    } catch (error: unknown) {
      throw new TenantContextReadException(error);
    }
  }
}
