import { Suspense } from 'react';
import { TenantLink as Link } from '@/features/dashboard/components/tenant-scope';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import {
  parseCatalogQuery,
  type CatalogKind,
  type CatalogSearchParams,
} from '@/features/dashboard/queries/catalog-query';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam } from '@/features/dashboard/utils/tenant-scope';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { CatalogToolbar } from '@/features/dashboard/components/catalog-toolbar';
import {
  CatalogResults,
  CatalogResultsSkeleton,
} from '@/features/dashboard/components/catalog-results';

export async function AdminCatalogScreen({
  kind,
  searchParams,
}: {
  kind: CatalogKind;
  searchParams: Promise<CatalogSearchParams>;
}): Promise<React.JSX.Element> {
  const [t, params] = await Promise.all([getTranslations('AdminCatalog'), searchParams]);
  const { userId, tenantId } = await requireDashboardPermission(
    [UserPermission.VIEW_CATALOG, UserPermission.MANAGE_CATALOG],
    tenantParam(params.tenant),
  );
  const query = parseCatalogQuery(params, kind);
  const title = t(kind === 'products' ? 'productsTitle' : 'categoriesTitle');
  return (
    <TenantScope tenantId={tenantId}>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader breadcrumbs={[{ label: title, href: null }]} />
        <div className="space-y-6 px-4 py-6 lg:px-6 lg:py-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-[1.75rem]">
                {title}
              </h1>
              <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[0.9375rem]">
                {t(kind === 'products' ? 'productsDescription' : 'categoriesDescription')}
              </p>
            </div>
            <Button
              nativeButton={false}
              role="link"
              render={<Link href={'/dashboard/catalog/' + kind + '/new'} />}
              className="min-h-11"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t(kind === 'products' ? 'newProduct' : 'newCategory')}
            </Button>
          </header>
          <CatalogToolbar kind={kind} query={query} />
          <Suspense
            key={JSON.stringify(query)}
            fallback={<CatalogResultsSkeleton label={t('loading')} />}
          >
            <CatalogResults kind={kind} query={query} userId={userId} tenantId={tenantId} />
          </Suspense>
        </div>
      </div>
    </TenantScope>
  );
}
