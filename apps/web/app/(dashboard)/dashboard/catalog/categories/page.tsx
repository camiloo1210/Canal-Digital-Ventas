import { getTranslations } from 'next-intl/server';
import { AdminCatalogScreen } from '@/features/dashboard/components/admin-catalog-screen';
import type { CatalogSearchParams } from '@/features/dashboard/queries/catalog-query';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('AdminCatalog');
  return { title: t('categoriesMetadata') };
}

export default function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}): React.JSX.Element {
  return <AdminCatalogScreen kind="categories" searchParams={searchParams} />;
}
