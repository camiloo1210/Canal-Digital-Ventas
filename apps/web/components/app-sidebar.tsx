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
  Store,
  ChartNoAxesCombined,
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
};

interface DashboardSidebarUser {
  name: string;
  email: string;
  avatar: string;
  tenantName: string;
  tenantSlug: string;
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: DashboardSidebarUser;
}): React.JSX.Element {
  const t = useTranslations('AdminShell');
  const pathname = usePathname();
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
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" onClick={closeOnNavigation} />}
            >
              <Store aria-hidden="true" className="size-5 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.tenantName}</p>
                <p className="text-xs text-muted-foreground">{t('administration')}</p>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t('navigation')}>
          <SidebarGroup>
            <SidebarGroupLabel>{t('workspace')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dashboardNavigation.map((item): React.JSX.Element => {
                  const Icon = icons[item.key];
                  const active = isDashboardDestinationActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={active}
                        className="min-h-11 text-sm"
                        render={
                          <Link
                            href={item.href}
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
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
