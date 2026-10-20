import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import { getCategoryReadRepository } from '@/features/categories/di/categories.di';
import { EditCategoryForm } from '@/features/categories/components/edit-category-form';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Categories');
  return { title: t('edit_title') };
}

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { tenantId } = await requireDashboardTenant();
  const category = await (await getCategoryReadRepository()).findById(id, tenantId);
  if (!category) notFound();
  const t = await getTranslations('Categories');
  return (
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
  );
}
