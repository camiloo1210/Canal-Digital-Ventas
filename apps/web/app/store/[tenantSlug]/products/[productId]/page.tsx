import { notFound } from 'next/navigation';
import { getStoreProductReadRepository } from '@/features/store/di/store.di';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/money';
import { StoreProductStockBadge } from '@/features/store/components/store-product-stock-badge';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';

export default async function ProductDetailPage(props: {
  params: Promise<{ tenantSlug: string; productId: string }>;
}): Promise<React.JSX.Element> {
  const params = await props.params;
  const { tenantSlug, productId } = params;

  const t = await getTranslations('Storefront');
  const repo = await getStoreProductReadRepository();

  const product = await repo.findDetail({ tenantSlug, productId });

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                {t('noImage')}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-start">
            {product.sku && (
              <span className="text-xs text-muted-foreground mb-2">{product.sku}</span>
            )}

            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">
              {product.name}
            </h1>

            <div className="text-4xl font-light text-foreground mb-3">
              {formatMoney(product.priceCents)}
            </div>

            {product.wholesalePriceCents !== null && product.wholesaleMinQuantity !== null && (
              <div className="mb-8 flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {t('wholesaleBadge')}
                </Badge>
                <span className="text-muted-foreground text-sm font-medium">
                  {formatMoney(product.wholesalePriceCents)} ({t('wholesaleMin')}:{' '}
                  {product.wholesaleMinQuantity})
                </span>
              </div>
            )}

            {!product.wholesalePriceCents && <div className="mb-8" />}

            <div className="border border-border rounded-xl p-6 mb-8 bg-card shadow-sm">
              <h2 className="text-lg font-medium mb-4">
                {t('aboutThisProduct', { fallback: 'About this product' })}
              </h2>
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {product.description || t('noDescription')}
              </div>
            </div>

            <div className="flex flex-col gap-6 pt-4">
              <div className="flex flex-col items-start gap-4">
                <h3 className="font-medium text-foreground">
                  {t('availability', { fallback: 'Availability' })}
                </h3>
                <StoreProductStockBadge availability={product.stockAvailability} />
              </div>
              <AddToCartButton
                productId={product.id}
                name={product.name}
                price={product.priceCents / 100}
                imageUrl={product.imageUrl ?? undefined}
                maxStock={product.inStock ? 9999 : 0}
                tenantSlug={tenantSlug}
                labels={{
                  add: t('cartAdd'),
                  outOfStock: t('cartOutOfStock'),
                  differentStoreTitle: t('cartDifferentStoreTitle'),
                  differentStoreDesc: t('cartDifferentStoreDesc'),
                  cancel: t('cartCancel'),
                  clearAndContinue: t('cartClearAndContinue'),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
