import * as React from 'react';
import { getStoreProductReadRepository } from '@/features/store/di/store.di';
import { StoreProductGrid } from './store-product-grid';
import { PAGE_SIZE } from '@/features/store/utils/store-filters.parser';

interface StoreResultsBoundaryProps {
  tenantSlug: string;
  categorySlug?: string;
  q?: string;
  page: number;
  pageInfoTemplate: string;
}

export async function StoreResultsBoundary({
  tenantSlug,
  categorySlug,
  q,
  page,
  pageInfoTemplate
}: StoreResultsBoundaryProps): Promise<React.JSX.Element> {
  const productRepo = await getStoreProductReadRepository();

  const productsResult = await productRepo.searchActiveByTenantSlug(
    tenantSlug,
    {
      categorySlug,
      name: q,
    },
    { page, limit: PAGE_SIZE }
  );

  return (
    <StoreProductGrid
      products={productsResult.items}
      currentPage={productsResult.currentPage}
      totalPages={productsResult.totalPages}
      pageInfoTemplate={pageInfoTemplate}
    />
  );
}

export function StoreResultsSkeleton(): React.JSX.Element {
  return (
    <div className="w-full flex flex-col opacity-50 pointer-events-none transition-opacity duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col border rounded-xl overflow-hidden shadow-sm bg-card">
            <div className="aspect-[4/3] bg-muted animate-pulse" />
            <div className="p-4 flex flex-col gap-3">
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
              <div className="mt-4 h-6 bg-muted animate-pulse rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
