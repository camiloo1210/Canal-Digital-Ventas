import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const userData = {
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Administrator',
    email: user.email || '',
    role: user.user_metadata?.role || 'Admin',
    tenantName: user.user_metadata?.tenant_name || 'Canal Digital',
    avatar: user.user_metadata?.avatar_url || '',
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
      <SidebarInset>
        
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
