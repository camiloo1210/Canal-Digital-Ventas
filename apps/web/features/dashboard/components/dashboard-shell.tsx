'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { BusinessOption } from '@/features/dashboard/utils/current-business';

export const SELECT_BUSINESS_ROUTE = '/dashboard/select-business';

/**
 * Sidebar shell of the dashboard. The business selector page renders without it: there is no
 * business to navigate yet, so the page is a focused choice in the login/onboarding style.
 */
export function DashboardShell({
  user,
  businesses,
  defaultTenantId,
  children,
}: {
  user: { name: string; email: string; avatar: string };
  businesses: readonly BusinessOption[];
  defaultTenantId: string | null;
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  if (pathname === SELECT_BUSINESS_ROUTE || pathname.startsWith(SELECT_BUSINESS_ROUTE + '/'))
    return (
      <main id="dashboard-main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    );
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '16rem', '--header-height': '3.5rem' } as React.CSSProperties}
    >
      <AppSidebar
        variant="inset"
        user={user}
        businesses={businesses}
        defaultTenantId={defaultTenantId}
      />
      <SidebarInset
        id="dashboard-main"
        tabIndex={-1}
        className="min-w-0 scroll-mt-16 bg-background focus:outline-none md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-border/70 md:peer-data-[variant=inset]:shadow-(--shadow-card)"
      >
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
