import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbItemProps {
  label: string;
  href?: string | null;
}

export async function PageHeader({
  breadcrumbs,
}: {
  breadcrumbs: BreadcrumbItemProps[];
}): Promise<React.JSX.Element> {
  const t = await getTranslations('AdminShell');
  const current = breadcrumbs[breadcrumbs.length - 1];
  const back = [...breadcrumbs].reverse().find((crumb): boolean => Boolean(crumb.href));
  return (
    <header className="flex min-h-(--header-height) shrink-0 items-center border-b">
      <div className="flex min-w-0 w-full items-center gap-3 px-4 py-2 lg:px-6">
        <SidebarTrigger className="size-11 shrink-0" aria-label={t('toggleNavigation')} />
        <Separator orientation="vertical" className="h-5 data-vertical:self-auto" />
        <div className="min-w-0 flex-1 md:hidden">
          {back?.href ? (
            <Link href={back.href} className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
              <span>{back.label}</span>
            </Link>
          ) : (
            <p className="text-sm font-medium">{current?.label}</p>
          )}
        </div>
        <Breadcrumb className="hidden min-w-0 md:block" aria-label={t('breadcrumb')}>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index): React.JSX.Element => (
              <React.Fragment key={String(index) + crumb.label}>
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>
                      {crumb.label}
                    </BreadcrumbLink>
                  ) : index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
