import { CreateProductForm } from '@/features/products/components/create-product-form';
import { getCategoryRepository } from '@/features/categories/di/categories.di';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CategoryStatus, Category } from '@canaldigital/packages/core';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'New Product | Canal Digital',
};

import { PageHeader } from '@/components/page-header';

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const tenantId = await getActiveTenantQuery(user.id);

  if (!tenantId) {
    redirect('/onboarding');
  }

  const t = await getTranslations('Products');

  const categoryRepo = await getCategoryRepository();
  const categoriesResult = await categoryRepo.searchByFilters(
    { tenantId, status: CategoryStatus.ACTIVE },
    { limit: 1000, page: 1 },
  );
  const categoriesDb = categoriesResult.items;

  // Strict serialization constraint: RSC to Client boundary allows strictly Plain View Models.
  // Explicitly mapping to ensure no Domain Entities/Value Objects cross into Client bundle.
  const categories = categoriesDb.map((c: Category) => ({
    id: c.getId(),
    name: c.getName(),
  }));

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <PageHeader breadcrumbs={[{ label: t('list_title'), href: '/dashboard/catalog/products' }, { label: t('new_title'), href: null }]} />
        <div className="flex flex-1 flex-col items-center py-6 md:py-10 px-4 lg:px-6">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight mb-8">{t('new_title')}</h1>
            <CreateProductForm categories={categories} />
          </div>
        </div>
      </div>
    </div>
  );
}
