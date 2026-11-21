'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { cn } from '@/lib/utils';
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
import type { BusinessOption } from '@/features/dashboard/utils/current-business';
import { withTenant } from '@/features/dashboard/utils/tenant-scope';
import {
  groupDashboardNavigation,
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

const GROUP_LABELS = {
  operation: 'groupOperation',
  catalog: 'groupCatalog',
  business: 'groupBusiness',
} as const;

interface DashboardSidebarUser {
  name: string;
  email: string;
  avatar: string;
}

export function AppSidebar({
  user,
  businesses,
  current,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: DashboardSidebarUser;
  businesses: readonly BusinessOption[];
  current: BusinessOption | null;
}): React.JSX.Element {
  const t = useTranslations('AdminShell');
  const pathname = usePathname();
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
      <SidebarHeader className="border-b border-sidebar-border p-4 pr-14 md:pr-4">
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
        <nav aria-label={t('navigation')} className="flex flex-col gap-2 px-2 pt-2">
          {groupDashboardNavigation(visibleKeys).map((group): React.JSX.Element => (
            <SidebarGroup key={group.key} className="py-1.5">
              <SidebarGroupLabel className="h-7 px-3 text-xs font-semibold text-sidebar-foreground/80">
                {t(GROUP_LABELS[group.key])}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item): React.JSX.Element => {
                    const Icon = icons[item.key];
                    const active = isDashboardDestinationActive(pathname, item.href);
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          isActive={active}
                          className={cn(
                            'min-h-11 gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors duration-150 motion-reduce:transition-none [&_svg]:size-[1.125rem]',
                            'hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                            'data-active:bg-sidebar-accent data-active:font-semibold data-active:text-sidebar-accent-foreground',
                          )}
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
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <NavUser
          user={{ ...user, tenantSlug: current?.tenantSlug ?? null }}
          tenantId={current?.tenantId}
          onNavigate={(): void => setOpenMobile(false)}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
