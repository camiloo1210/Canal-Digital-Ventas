import { getTranslations } from 'next-intl/server';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import { CreateCategoryForm } from '@/features/categories/components/create-category-form';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Categories');
  return { title: t('new_title') };
}

export default async function NewCategoryPage(): Promise<React.JSX.Element> {
  await requireDashboardTenant();
  const t = await getTranslations('Categories');
  return (
    <CatalogFormPage
      title={t('new_title')}
      description={t('new_desc')}
      backHref="/dashboard/catalog/categories"
      backLabel={t('list_title')}
      compact
    >
      <CreateCategoryForm />
    </CatalogFormPage>
  );
}
