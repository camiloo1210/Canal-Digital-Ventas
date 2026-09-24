import { notFound } from 'next/navigation';
import { resolveTenantQuery } from '@/features/iam/queries/resolve-tenant.query';
import { parseStoreFilters, PAGE_SIZE } from '@/features/store/utils/store-filters.parser';
import { getStoreCategoryReadRepository, getStoreProductReadRepository } from '@/features/store/di/store.di';
import { StoreCategorySidebar } from '@/features/store/components/store-category-sidebar';
import { StoreProductGrid } from '@/features/store/components/store-product-grid';
import { StoreSearchBar } from '@/features/store/components/store-search-bar';
import { StoreProfileHeader } from '@/features/store/components/store-profile-header';
import { ProductStatus, CategoryStatus, createTenantId, createCategoryId } from '@canaldigital/packages/core';
import { getTranslations } from 'next-intl/server';

export default async function StorePage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const t = await getTranslations('Storefront');

  const tenantContext = await resolveTenantQuery(params.tenantSlug);
  
  if (!tenantContext) {
    notFound();
  }

  const filters = parseStoreFilters(searchParams);

  const categoryRepo = await getStoreCategoryReadRepository();
  const productRepo = await getStoreProductReadRepository();

  const categoriesResult = await categoryRepo.searchActiveByTenantSlug(params.tenantSlug);

  const productsResult = await productRepo.searchActiveByTenantSlug(
    params.tenantSlug,
    {
      categorySlug: filters.category,
      name: filters.q,
    },
    { page: filters.page, limit: PAGE_SIZE }
  );

  return (
    <div className="flex flex-col min-h-screen">
      <StoreProfileHeader 
        name={tenantContext.name}
        description={tenantContext.description}
        logoUrl={tenantContext.logoUrl}
        bannerUrl={tenantContext.bannerUrl}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full flex flex-col">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <StoreSearchBar placeholder={t('searchProducts')} />
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start">
        <StoreCategorySidebar
          categories={categoriesResult}
          currentCategorySlug={filters.category}
          labels={{
            categories: t('categories'),
            allProducts: t('allProducts'),
            noCategories: t('noCategories')
          }}
        />
        
        <div className="flex-1 w-full">
          <StoreProductGrid
            products={productsResult.items}
            currentPage={productsResult.currentPage}
            totalPages={productsResult.totalPages}
            pageInfoTemplate={t('pageInfo', { current: '{current}', total: '{total}' })}
          />
        </div>
      </div>
    </div>
    </div>
  );
}
