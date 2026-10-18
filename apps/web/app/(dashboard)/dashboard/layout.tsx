import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  let tenantSlug = null;
  const { data: tenantData } = await supabase
    .schema('core')
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (tenantData) {
    const { data: t } = await supabase
      .schema('core')
      .from('tenants')
      .select('slug')
      .eq('id', tenantData.tenant_id)
      .single();
    if (t) tenantSlug = t.slug;
  }

  const userData = {
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Administrator',
    email: user.email || '',
    role: user.user_metadata?.role || 'Admin',
    tenantName: user.user_metadata?.tenant_name || 'Canal Digital',
    avatar: user.user_metadata?.avatar_url || '',
    tenantSlug,
  };

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={userData} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
