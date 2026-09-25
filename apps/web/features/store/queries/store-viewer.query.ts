import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';

export type StoreViewer = {
  isAuthenticated: boolean;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  hasDashboardAccess: boolean;
};

export async function getStoreViewerQuery(): Promise<StoreViewer> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      isAuthenticated: false,
      displayName: null,
      email: null,
      avatarUrl: null,
      hasDashboardAccess: false,
    };
  }

  const activeTenantId = await getActiveTenantQuery(user.id);

  return {
    isAuthenticated: true,
    displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    email: user.email || null,
    avatarUrl: user.user_metadata?.avatar_url || null,
    hasDashboardAccess: activeTenantId !== null,
  };
}
