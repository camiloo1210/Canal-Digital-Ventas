import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import { getCategoryReadRepository } from '@/features/categories/di/categories.di';
import { EditCategoryForm } from '@/features/categories/components/edit-category-form';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam, type TenantSearchParams } from '@/features/dashboard/utils/tenant-scope';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Categories');
  return { title: t('edit_title') };
}

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<TenantSearchParams>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { tenantId } = await requireDashboardPermission(
    UserPermission.MANAGE_CATALOG,
    tenantParam((await searchParams).tenant),
  );
  const category = await (await getCategoryReadRepository()).findById(id, tenantId);
  if (!category) notFound();
  const t = await getTranslations('Categories');
  return (
    <TenantScope tenantId={tenantId}>
      <CatalogFormPage
        title={t('edit_title')}
        description={t('edit_desc')}
        backHref="/dashboard/catalog/categories"
        backLabel={t('list_title')}
        compact
      >
        <EditCategoryForm
          initialData={{
            id: category.id,
            version: category.version,
            name: category.name,
            description: category.description ?? '',
          }}
        />
      </CatalogFormPage>
    </TenantScope>
  );
}
