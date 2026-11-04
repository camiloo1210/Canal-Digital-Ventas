import { getTranslations } from 'next-intl/server';
import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import { CreateCategoryForm } from '@/features/categories/components/create-category-form';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam, type TenantSearchParams } from '@/features/dashboard/utils/tenant-scope';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Categories');
  return { title: t('new_title') };
}

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<TenantSearchParams>;
}): Promise<React.JSX.Element> {
  const { tenantId } = await requireDashboardPermission(
    UserPermission.MANAGE_CATALOG,
    tenantParam((await searchParams).tenant),
  );
  const t = await getTranslations('Categories');
  return (
    <TenantScope tenantId={tenantId}>
      <CatalogFormPage
        title={t('new_title')}
        description={t('new_desc')}
        backHref="/dashboard/catalog/categories"
        backLabel={t('list_title')}
        compact
      >
        <CreateCategoryForm />
      </CatalogFormPage>
    </TenantScope>
  );
}
