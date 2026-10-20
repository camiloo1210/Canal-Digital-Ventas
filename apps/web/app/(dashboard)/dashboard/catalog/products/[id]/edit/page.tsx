import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireDashboardTenant } from '@/features/dashboard/queries/dashboard-context.query';
import { getProductReadRepository } from '@/features/products/di/products.di';
import { getAdminCatalogReadRepository } from '@/features/dashboard/di/dashboard.di';
import { EditProductForm } from '@/features/products/components/edit-product-form';
import { CatalogFormPage } from '@/features/dashboard/components/catalog-form-page';
import { formatMinorUnitsForInput } from '@/lib/money';
import type { ProductEditValues } from '@/features/products/schemas/product-form.schema';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('Products');
  return { title: t('edit_title') };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const { userId, tenantId } = await requireDashboardTenant();
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
    price: formatMinorUnitsForInput(productData.price_cents),
    cost: formatMinorUnitsForInput(productData.cost_cents),
    wholesalePrice: formatMinorUnitsForInput(productData.wholesale_price_cents),
    wholesaleMinQuantity:
      productData.wholesale_min_quantity === null ? '' : String(productData.wholesale_min_quantity),
    stock: String(productData.stock),
    isVatExempt: productData.is_vat_exempt ? 'on' : '',
    imageUrl: productData.image_url,
  };
  return (
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
  );
}
