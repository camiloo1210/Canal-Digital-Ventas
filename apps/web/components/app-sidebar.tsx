'use client';

import * as React from 'react';
import Link from 'next/link';

import { NavSecondary } from '@/components/nav-secondary';
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
} from '@/components/ui/sidebar';
import { Collapsible } from '@base-ui/react/collapsible';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Tags,
  Archive,
  ShoppingCart,
  CreditCard,
  Users,
  ShieldCheck,
  Bell,
  MessageSquare,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  CommandIcon,
  ChevronRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type SidebarMessageKey =
  | 'title'
  | 'subtitle'
  | 'analytics_dashboard'
  | 'dashboard'
  | 'top_products'
  | 'catalog'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'sales'
  | 'orders'
  | 'payments'
  | 'crm'
  | 'users'
  | 'roles'
  | 'communications'
  | 'notifications'
  | 'whatsapp'
  | 'settings'
  | 'help'
  | 'search';

interface NavigationItem {
  title: SidebarMessageKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavigationGroup {
  label: SidebarMessageKey;
  items: NavigationItem[];
}

const navigation: NavigationGroup[] = [
  {
    label: 'analytics_dashboard',
    items: [
      {
        title: 'dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'top_products',
        href: '/dashboard/analytics/top-products',
        icon: TrendingUp,
      },
    ],
  },
  {
    label: 'catalog',
    items: [
      {
        title: 'products',
        href: '/dashboard/catalog/products',
        icon: Package,
      },
      {
        title: 'categories',
        href: '/dashboard/catalog/categories',
        icon: Tags,
      },
      {
        title: 'inventory',
        href: '/dashboard/catalog/inventory',
        icon: Archive,
      },
    ],
  },
  {
    label: 'sales',
    items: [
      {
        title: 'orders',
        href: '/dashboard/orders',
        icon: ShoppingCart,
      },
      {
        title: 'payments',
        href: '/dashboard/payments',
        icon: CreditCard,
      },
    ],
  },
  {
    label: 'crm',
    items: [
      {
        title: 'users',
        href: '/dashboard/users',
        icon: Users,
      },
      {
        title: 'roles',
        href: '/dashboard/users/roles',
        icon: ShieldCheck,
      },
    ],
  },
  {
    label: 'communications',
    items: [
      {
        title: 'notifications',
        href: '/dashboard/communications/notifications',
        icon: Bell,
      },
      {
        title: 'whatsapp',
        href: '/dashboard/communications/whatsapp',
        icon: MessageSquare,
      },
    ],
  },
];

interface NavSecondaryItem {
  title: SidebarMessageKey;
  url: string;
  icon: React.ReactNode;
}

const navSecondary: NavSecondaryItem[] = [
  {
    title: 'settings',
    url: '#',
    icon: <Settings2Icon />,
  },
  {
    title: 'help',
    url: '#',
    icon: <CircleHelpIcon />,
  },
  {
    title: 'search',
    url: '#',
    icon: <SearchIcon />,
  },
];

type UserProp = {
  name: string;
  email: string;
  avatar: string;
  role?: string;
  tenantName?: string;
};

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: UserProp }): React.JSX.Element {
  const t = useTranslations('Sidebar');

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CommandIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{t('title')}</span>
                <span className="truncate text-xs">{t('subtitle')}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((group) => (
          <Collapsible.Root key={group.label} defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel
                render={
                  <Collapsible.Trigger className="flex w-full cursor-pointer items-center justify-between hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
                }
              >
                {t(group.label)}
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[open]/collapsible:rotate-90 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarGroupLabel>
              <Collapsible.Panel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton render={<Link href={item.href} />}>
                          <item.icon />
                          <span>{t(item.title)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </Collapsible.Panel>
            </SidebarGroup>
          </Collapsible.Root>
        ))}

        <NavSecondary
          items={navSecondary.map((item) => ({ ...item, title: t(item.title) }))}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
