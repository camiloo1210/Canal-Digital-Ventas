'use client';

import React from 'react';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export function SiteHeader() {
  const pathname = usePathname();
  const tSidebar = useTranslations('Sidebar');
  const tProducts = useTranslations('Products');

  const breadcrumbs = [];

  if (pathname.includes('/catalog/products/new')) {
    breadcrumbs.push({ label: tProducts('list_title'), href: '/dashboard/catalog/products' });
    breadcrumbs.push({ label: tProducts('new_title'), href: null });
  } else if (pathname.includes('/catalog/products')) {
    breadcrumbs.push({ label: tProducts('list_title'), href: null });
  } else if (pathname.includes('/catalog/categories')) {
    breadcrumbs.push({ label: tSidebar('categories'), href: null });
  } else if (pathname.includes('/catalog/inventory')) {
    breadcrumbs.push({ label: tSidebar('inventory'), href: null });
  } else if (pathname.includes('/orders')) {
    breadcrumbs.push({ label: tSidebar('orders'), href: null });
  } else if (pathname.includes('/payments')) {
    breadcrumbs.push({ label: tSidebar('payments'), href: null });
  } else if (pathname.includes('/users/roles')) {
    breadcrumbs.push({ label: tSidebar('users'), href: '/dashboard/users' });
    breadcrumbs.push({ label: tSidebar('roles'), href: null });
  } else if (pathname.includes('/users')) {
    breadcrumbs.push({ label: tSidebar('users'), href: null });
  } else if (pathname.includes('/communications/notifications')) {
    breadcrumbs.push({ label: tSidebar('notifications'), href: null });
  } else if (pathname.includes('/communications/whatsapp')) {
    breadcrumbs.push({ label: tSidebar('whatsapp'), href: null });
  } else if (pathname.includes('/analytics/top-products')) {
    breadcrumbs.push({ label: tSidebar('top_products'), href: null });
  } else {
    breadcrumbs.push({ label: tSidebar('dashboard'), href: null });
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.label}>
                <BreadcrumbItem className="hidden md:block">
                  {crumb.href ? (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>
                      {crumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
