import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface ActiveTenantListModel {
  id: string;
  name: string;
  slug: string;
}

export async function listActiveTenantsQuery(): Promise<ActiveTenantListModel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('list_public_active_tenants');

  if (error) {
    console.error('Failed to list active tenants:', error);
    return [];
  }

  return data as ActiveTenantListModel[];
}
