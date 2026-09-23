import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface PublicTenantContext {
  tenantId: string;
  status: string;
}

export async function resolveTenantQuery(slug: string): Promise<PublicTenantContext | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('get_public_tenant_by_slug', { p_tenant_slug: slug })
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error(`Failed to resolve tenant slug '${slug}':`, error);
    }
    return null;
  }

  return {
    tenantId: (data as { id: string }).id,
    status: 'active',
  };
}
