import { getTranslations } from 'next-intl/server';
import { TenantLink as Link } from '@/features/dashboard/components/tenant-scope';
import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import { getAdminCatalogReadRepository } from '@/features/dashboard/di/dashboard.di';
import { CreateProductForm } from '@/features/products/components/create-product-form';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam, type TenantSearchParams } from '@/features/dashboard/utils/tenant-scope';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Products');
  return { title: t('new_title') };
}

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<TenantSearchParams>;
}): Promise<React.JSX.Element> {
  const { userId, tenantId } = await requireDashboardPermission(
    UserPermission.MANAGE_CATALOG,
    tenantParam((await searchParams).tenant),
  );
  const [t, f, context] = await Promise.all([
    getTranslations('Products'),
    getTranslations('CatalogForms'),
    getAdminCatalogReadRepository().findProductFormContextForManager(userId, tenantId),
  ]);
  return (
    <TenantScope tenantId={tenantId}>
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
    </TenantScope>
  );
}
