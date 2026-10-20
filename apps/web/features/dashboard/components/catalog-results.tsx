import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PackageSearch } from 'lucide-react';
import type {
  AdminCatalogPage,
  AdminCatalogQuery,
  AdminCategoryCatalogItem,
  AdminProductCatalogItem,
} from '@canaldigital/packages/core';
import { getAdminCatalogReadRepository } from '@/features/dashboard/di/dashboard.di';
import { catalogHref, type CatalogKind } from '@/features/dashboard/queries/catalog-query';
import { ProductCatalogTable } from '@/features/dashboard/components/product-catalog-table';
import { CategoryCatalogTable } from '@/features/dashboard/components/category-catalog-table';
import { CatalogPagination } from '@/features/dashboard/components/catalog-pagination';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export async function CatalogResults({
  kind,
  query,
  userId,
  tenantId,
}: {
  kind: CatalogKind;
  query: AdminCatalogQuery;
  userId: string;
  tenantId: string;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('AdminCatalog');
  let products: AdminCatalogPage<AdminProductCatalogItem> | null = null;
  let categories: AdminCatalogPage<AdminCategoryCatalogItem> | null = null;
  let failed = false;
  try {
    const repository = getAdminCatalogReadRepository();
    if (kind === 'products')
      products = await repository.findProductsForManager(userId, tenantId, query);
    else categories = await repository.findCategoriesForManager(userId, tenantId, query);
  } catch (error: unknown) {
    console.error('[AdminCatalog]', error);
    failed = true;
  }
  const result = products ?? categories;
  if (!result)
    return (
      <Alert role="alert">
        <AlertTitle>{t(failed ? 'errorTitle' : 'accessTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t(failed ? 'errorDescription' : 'accessDescription')}</p>
          {failed && (
            <form action={'/dashboard/catalog/' + kind} method="get">
              <input type="hidden" name="q" value={query.q} />
              <input type="hidden" name="status" value={query.status} />
              <input type="hidden" name="page" value={query.page} />
              <Button type="submit" variant="outline" className="mt-3 min-h-11">
                {t('retry')}
              </Button>
            </form>
          )}
        </AlertDescription>
      </Alert>
    );
  // Redirects must stay outside the query catch; Next.js uses a thrown redirect signal.
  if (query.page > result.totalPages) redirect(catalogHref(kind, query, result.totalPages));
  const filtered = Boolean(query.q || query.status !== 'all');
  return (
    <section
      aria-label={t(kind === 'products' ? 'productsTitle' : 'categoriesTitle')}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <p className="text-sm font-medium">{t('results', { count: result.totalItems })}</p>
        <p className="text-xs text-muted-foreground">{t('sort')}</p>
      </div>
      {result.items.length === 0 ? (
        <Empty className="min-h-72">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {t(
                filtered
                  ? 'noResultsTitle'
                  : kind === 'products'
                    ? 'emptyProductsTitle'
                    : 'emptyCategoriesTitle',
              )}
            </EmptyTitle>
            <EmptyDescription>
              {t(
                filtered
                  ? 'noResultsDescription'
                  : kind === 'products'
                    ? 'emptyProductsDescription'
                    : 'emptyCategoriesDescription',
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              role="link"
              variant="outline"
              className="min-h-11"
              render={<Link href={'/dashboard/catalog/' + kind + (filtered ? '' : '/new')} />}
            >
              {t(filtered ? 'clear' : kind === 'products' ? 'newProduct' : 'newCategory')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : products ? (
        <ProductCatalogTable items={products.items} />
      ) : categories ? (
        <CategoryCatalogTable items={categories.items} />
      ) : null}
      <CatalogPagination
        kind={kind}
        query={query}
        totalItems={result.totalItems}
        totalPages={result.totalPages}
      />
    </section>
  );
}

export function CatalogResultsSkeleton({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="space-y-3 rounded-xl border p-5"
    >
      <Skeleton aria-hidden="true" className="h-8 w-40 motion-reduce:animate-none" />
      {[0, 1, 2, 3, 4].map((row): React.JSX.Element => (
        <Skeleton key={row} aria-hidden="true" className="h-16 w-full motion-reduce:animate-none" />
      ))}
    </div>
  );
}
