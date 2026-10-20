import * as React from 'react';
import { getStoreProductReadRepository } from '@/features/store/di/store.di';
import { StoreProductGrid } from '@/features/store/components/store-product-grid';
import { PAGE_SIZE } from '@/features/store/utils/store-filters.parser';
import { StorePagination } from '@/features/store/components/store-pagination';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  STORE_PRODUCT_GRID,
  STORE_PRODUCT_CARD,
  STORE_PRODUCT_MEDIA,
} from '@/features/store/components/store-product-layout';

interface StoreResultsBoundaryProps {
  tenantSlug: string;
  categorySlug?: string;
  q?: string;
  page: number;
}

export async function StoreResultsBoundary({
  tenantSlug,
  categorySlug,
  q,
  page,
}: StoreResultsBoundaryProps): Promise<React.JSX.Element> {
  const productRepo = await getStoreProductReadRepository();
  const t = await getTranslations('Storefront');

  const productsResult = await productRepo.searchActiveByTenantSlug(
    tenantSlug,
    {
      categorySlug,
      name: q,
    },
    { page, limit: PAGE_SIZE },
  );

  return (
    <section aria-label={t('allProducts')}>
      <p className="mb-4 text-sm text-muted-foreground" role="status" aria-live="polite">
        {t('resultsCount', { count: productsResult.totalItems })}
      </p>
      <StoreProductGrid
        products={productsResult.items}
        tenantSlug={tenantSlug}
        q={q}
        categorySlug={categorySlug}
        outOfRange={productsResult.totalItems > 0 && productsResult.items.length === 0}
      />
      <StorePagination
        tenantSlug={tenantSlug}
        q={q}
        categorySlug={categorySlug}
        currentPage={productsResult.currentPage}
        totalPages={productsResult.totalPages}
      />
    </section>
  );
}

export function StoreResultsSkeleton({ label }: { label: string }): React.JSX.Element {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="w-full">
      <Skeleton aria-hidden="true" className="mb-4 h-5 w-32 motion-reduce:animate-none" />
      <div aria-hidden="true" className={STORE_PRODUCT_GRID}>
        {Array.from({ length: 8 }, (_, i): React.JSX.Element => (
          <Card key={i} className={STORE_PRODUCT_CARD}>
            <Skeleton
              className={`${STORE_PRODUCT_MEDIA} rounded-none motion-reduce:animate-none`}
            />
            <CardContent className="flex flex-1 flex-col gap-3 p-(--card-spacing)">
              <div className="min-h-10 space-y-2">
                <Skeleton className="h-4 w-3/4 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-1/2 motion-reduce:animate-none" />
              </div>
              <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                <Skeleton className="h-7 w-20 motion-reduce:animate-none" />
                <Skeleton className="h-5 w-16 motion-reduce:animate-none" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
