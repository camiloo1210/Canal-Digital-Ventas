import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import { getAdminCatalogReadRepository } from '@/features/dashboard/di/dashboard.di';
import { CreateProductForm } from '@/features/products/components/create-product-form';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Products');
  return { title: t('new_title') };
}

export default async function NewProductPage(): Promise<React.JSX.Element> {
  const { userId, tenantId } = await requireDashboardTenant();
  const [t, f, context] = await Promise.all([
    getTranslations('Products'),
    getTranslations('CatalogForms'),
    getAdminCatalogReadRepository().findProductFormContextForManager(userId, tenantId),
  ]);
  return (
    <CatalogFormPage
      title={t('new_title')}
      description={t('new_desc')}
      backHref="/dashboard/catalog/products"
      backLabel={t('list_title')}
    >
      {context && context.categories.length > 0 ? (
        <CreateProductForm categories={context.categories} currency={context.currency} />
      ) : (
        <Alert role="alert">
          <AlertTitle>{f(context ? 'noCategoriesTitle' : 'tenantUnavailable')}</AlertTitle>
          <AlertDescription>
            {context && (
              <>
                <p>{f('noCategoriesHelp')}</p>
                <Button
                  nativeButton={false}
                  role="link"
                  render={<Link href="/dashboard/catalog/categories/new" />}
                  className="mt-3 min-h-11"
                >
                  {f('createCategory')}
                </Button>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
    </CatalogFormPage>
  );
}
