'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Paintbrush,
  Plug,
  ChartNoAxesCombined,
  UsersRound,
} from 'lucide-react';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { BusinessSwitcher } from '@/features/dashboard/components/business-switcher';
import { currentBusiness, type BusinessOption } from '@/features/dashboard/utils/current-business';
import { TENANT_PARAM, withTenant } from '@/features/dashboard/utils/tenant-scope';
import {
  dashboardNavigation,
  isDashboardDestinationActive,
} from '@/features/dashboard/navigation/dashboard-navigation';

const icons = {
  overview: LayoutDashboard,
  businessIntelligence: ChartNoAxesCombined,
  orders: ShoppingCart,
  products: Package,
  categories: Tags,
  store: Paintbrush,
  integrations: Plug,
  users: UsersRound,
};

interface DashboardSidebarUser {
  name: string;
  email: string;
  avatar: string;
}

export function AppSidebar({
  user,
  businesses,
  defaultTenantId,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: DashboardSidebarUser;
  businesses: readonly BusinessOption[];
  defaultTenantId: string | null;
}): React.JSX.Element {
  const t = useTranslations('AdminShell');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Every link below names its business (?tenant=); the server validates it on each request.
  const current = currentBusiness(businesses, searchParams.get(TENANT_PARAM), defaultTenantId);
  const visibleKeys = current?.visibleKeys ?? [];
  const { isMobile, setOpenMobile } = useSidebar();
  const focusAfterNavigation = React.useRef(false);
  React.useEffect((): (() => void) | undefined => {
    if (!focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    const frame = requestAnimationFrame((): void =>
      document.getElementById('dashboard-main')?.focus(),
    );
    return (): void => cancelAnimationFrame(frame);
  }, [pathname]);

  const closeOnNavigation = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (
      !isMobile ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    setOpenMobile(false);
    focusAfterNavigation.current = true;
    // Clicking the current destination does not change pathname.
    if (event.currentTarget.pathname === pathname) {
      focusAfterNavigation.current = false;
      requestAnimationFrame((): void => document.getElementById('dashboard-main')?.focus());
    }
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="p-3 pr-14 md:pr-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <BusinessSwitcher
              businesses={businesses}
              current={current}
              onNavigate={(): void => setOpenMobile(false)}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('navigation')}>
          <SidebarGroup>
            <SidebarGroupLabel>{t('workspace')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dashboardNavigation
                  .filter((item): boolean => visibleKeys.includes(item.key))
                  .map((item): React.JSX.Element => {
                    const Icon = icons[item.key];
                    const active = isDashboardDestinationActive(pathname, item.href);
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={active}
                          className="min-h-11 text-sm"
                          render={
                            <Link
                              href={withTenant(item.href, current?.tenantId)}
                              onClick={closeOnNavigation}
                              aria-current={active ? 'page' : undefined}
                            />
                          }
                        >
                          <Icon aria-hidden="true" />
                          <span>{t(item.key)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <NavUser user={{ ...user, tenantSlug: current?.tenantSlug ?? null }} />
      </SidebarFooter>
    </Sidebar>
  );
}
