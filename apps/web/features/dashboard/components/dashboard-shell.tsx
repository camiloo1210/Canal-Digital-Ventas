'use client';

import { createContext, useContext } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { DashboardBrandTheme } from '@/features/dashboard/components/dashboard-brand-theme';
import {
  publicLogoSource,
  StoreIdentityLogo,
} from '@/features/dashboard/components/store-identity-logo';
import { currentBusiness, type BusinessOption } from '@/features/dashboard/utils/current-business';
import { TENANT_PARAM } from '@/features/dashboard/utils/tenant-scope';

export const SELECT_BUSINESS_ROUTE = '/dashboard/select-business';

const DashboardBusinessContext = createContext<BusinessOption | null>(null);

export function DashboardBusinessName(): React.JSX.Element | null {
  const business = useContext(DashboardBusinessContext);
  const { open, isMobile } = useSidebar();
  if (!business) return null;

  return (
    <>
      {(isMobile || !open) && (
        <StoreIdentityLogo logoUrl={publicLogoSource(business.logoUrl)} className="size-7" />
      )}
      <span
        title={business.tenantName}
        className="max-w-[35%] shrink-0 truncate text-sm font-semibold text-foreground"
      >
        {business.tenantName}
      </span>
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    </>
  );
}

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
  const searchParams = useSearchParams();
  const current = currentBusiness(businesses, searchParams.get(TENANT_PARAM), defaultTenantId);
  if (pathname === SELECT_BUSINESS_ROUTE || pathname.startsWith(SELECT_BUSINESS_ROUTE + '/'))
    return (
      <main id="dashboard-main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    );
  return (
    <DashboardBusinessContext.Provider value={current}>
      <DashboardBrandTheme logoUrl={publicLogoSource(current?.logoUrl)} />
      <SidebarProvider
        style={{ '--sidebar-width': '15rem', '--header-height': '3.75rem' } as React.CSSProperties}
      >
        <AppSidebar user={user} businesses={businesses} current={current} />
        <SidebarInset
          id="dashboard-main"
          tabIndex={-1}
          className="min-w-0 scroll-mt-16 bg-background focus:outline-none"
        >
          {children}
        </SidebarInset>
      </SidebarProvider>
    </DashboardBusinessContext.Provider>
  );
}
