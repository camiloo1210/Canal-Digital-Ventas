import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireDashboardPermission } from '@/features/dashboard/queries/dashboard-context.query';
import { UserPermission } from '@canaldigital/packages/core';
import { getProductReadRepository } from '@/features/products/di/products.di';
import { getAdminCatalogReadRepository } from '@/features/dashboard/di/dashboard.di';
import { EditProductForm } from '@/features/products/components/edit-product-form';
import { TenantScope } from '@/features/dashboard/components/tenant-scope';
import { tenantParam, type TenantSearchParams } from '@/features/dashboard/utils/tenant-scope';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';
import { formatMinorUnitsForInput } from '@/lib/money';
import type { ProductEditValues } from '@/features/products/schemas/product-form.schema';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Products');
  return { title: t('edit_title') };
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<TenantSearchParams>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { userId, tenantId } = await requireDashboardPermission(
    UserPermission.MANAGE_CATALOG,
    tenantParam((await searchParams).tenant),
  );
  const productData = await (await getProductReadRepository()).getProductForEdit(id, tenantId);
  if (!productData) notFound();
  const [t, context] = await Promise.all([
    getTranslations('Products'),
    getAdminCatalogReadRepository().findProductFormContextForManager(
      userId,
      tenantId,
      productData.category_id,
    ),
  ]);
  if (!context) notFound();
  const product: ProductEditValues = {
    id: productData.id,
    version: productData.version,
    name: productData.name,
    sku: productData.sku,
    categoryId: productData.category_id,
    description: productData.description ?? '',
    price: formatMinorUnitsForInput(productData.price_cents, context.currency),
    cost: formatMinorUnitsForInput(productData.cost_cents, context.currency),
    wholesalePrice: formatMinorUnitsForInput(productData.wholesale_price_cents, context.currency),
    wholesaleMinQuantity:
      productData.wholesale_min_quantity === null ? '' : String(productData.wholesale_min_quantity),
    stock: String(productData.stock),
    isVatExempt: productData.is_vat_exempt ? 'on' : '',
    imageUrl: productData.image_url,
    galleryUrls:
      productData.gallery_urls && productData.gallery_urls.length > 0
        ? productData.gallery_urls
        : productData.image_url
          ? [productData.image_url]
          : [],
  };
  return (
    <TenantScope tenantId={tenantId}>
      <CatalogFormPage
        title={t('edit_title')}
        description={t('edit_desc')}
        backHref="/dashboard/catalog/products"
        backLabel={t('list_title')}
      >
        <EditProductForm
          product={product}
          categories={context.categories}
          currency={context.currency}
        />
      </CatalogFormPage>
    </TenantScope>
  );
}
