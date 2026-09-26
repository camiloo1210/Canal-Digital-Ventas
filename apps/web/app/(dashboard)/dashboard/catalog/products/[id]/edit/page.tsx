import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { formatMinorUnitsForInput } from '@/lib/money';
import { getProductReadRepository } from '@/features/products/di/products.di';
import { EditProductForm } from '@/features/products/components/edit-product-form';
import { getCategoryRepository } from '@/features/categories/di/categories.di';
import { CategoryStatus, Category } from '@canaldigital/packages/core';

import { PageHeader } from '@/components/page-header';

export default async function EditProductPage(props: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const params = await props.params;
  const t = await getTranslations('Products');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.app_metadata?.app_tenant_id) {
    redirect('/login');
  }

  const tenantId = user.app_metadata.app_tenant_id;
  const repository = await getProductReadRepository();
  const productData = await repository.getProductForEdit(params.id, tenantId);

  if (!productData) {
    notFound();
  }

    const viewModel = {
    id: productData.id,
    name: productData.name,
    price: formatMinorUnitsForInput(productData.price_cents),
    cost: formatMinorUnitsForInput(productData.cost_cents),
    wholesalePrice: formatMinorUnitsForInput(productData.wholesale_price_cents),
    description: productData.description || '',
    stock: productData.stock,
    categoryId: productData.category_id,
    sku: productData.sku,
    isVatExempt: productData.is_vat_exempt,
    version: productData.version,
    imageUrl: productData.image_url,
  };

  const categoryRepo = await getCategoryRepository();
  const categoriesResult = await categoryRepo.searchByFilters(
    { tenantId, status: CategoryStatus.ACTIVE },
    { limit: 1000, page: 1 },
  );

  const categories = categoriesResult.items.map((c: Category) => ({
    id: c.getId(),
    name: c.getName(),
  }));

  return (
    <>
    <PageHeader breadcrumbs={[{ label: t('list_title'), href: '/dashboard/catalog/products' }, { label: viewModel.name, href: null }, { label: t('action_edit'), href: null }]} />
    <div className="w-full flex justify-center pb-12 pt-6">
      <div className="max-w-2xl w-full flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('edit_title', { fallback: 'Edit Product' })}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('edit_desc', { fallback: 'Modify the details of your existing product.' })}
          </p>
        </div>

        <div className="w-full">
          <EditProductForm product={viewModel} categories={categories} />
        </div>
      </div>
    </div>
    </>
  );
}
