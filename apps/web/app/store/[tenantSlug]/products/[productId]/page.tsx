import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  getStoreProductReadRepository,
  getStorePurchaseInfoReadRepository,
} from '@/features/store/di/store.di';
import { getLocale, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/money';
import { StoreProductStockBadge } from '@/features/store/components/store-product-stock-badge';
import { ProductImageCarousel } from '@/features/store/components/product-image-carousel';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button';

export default async function ProductDetailPage(props: {
  params: Promise<{ tenantSlug: string; productId: string }>;
}): Promise<React.JSX.Element> {
  const params = await props.params;
  const { tenantSlug, productId } = params;

  const t = await getTranslations('Storefront');
  const locale = await getLocale();
  const repo = await getStoreProductReadRepository();

  const [viewer, product, purchaseInfo] = await Promise.all([
    getStoreViewerQuery(),
    repo.findDetail({ tenantSlug, productId }),
    getStorePurchaseInfoReadRepository()
      .findActive({ tenantSlug, productId })
      .catch((error: unknown): null => {
        console.error('[StorefrontProduct] purchase info unavailable', error);
        return null;
      }),
  ]);

  if (!product) {
    notFound();
  }

  const galleryImages =
    purchaseInfo && purchaseInfo.galleryUrls.length > 0
      ? purchaseInfo.galleryUrls
      : product.imageUrl
        ? [product.imageUrl]
        : [];
  const maxQuantity = purchaseInfo?.availableQuantity ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Link
          href={`/store/${tenantSlug}`}
          className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('backToProducts')}
        </Link>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-14">
          <div className="min-w-0 md:sticky md:top-6 md:self-start">
            <ProductImageCarousel images={galleryImages} alt={product.name} />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <header className="space-y-3">
              {product.sku && (
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('sku')}: {product.sku}
                </p>
              )}
              <h1 className="text-balance text-2xl font-semibold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">
                {product.name}
              </h1>
            </header>

            <section
              aria-label={t('availability')}
              className="space-y-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
            >
              <div className="space-y-2">
                <p className="text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                  {formatMoney(product.priceCents, product.currency, locale)}
                </p>
                {product.wholesalePriceCents !== null && product.wholesaleMinQuantity !== null && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t('wholesaleBadge')}</Badge>
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">
                      {formatMoney(product.wholesalePriceCents, product.currency, locale)} (
                      {t('wholesaleMin')}: {product.wholesaleMinQuantity})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <span className="text-sm text-muted-foreground">{t('availability')}</span>
                <StoreProductStockBadge availability={product.stockAvailability} />
                {viewer.isAuthenticated && purchaseInfo && (
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {t('purchase.limited', { count: maxQuantity })}
                  </span>
                )}
              </div>

              <AddToCartButton
                key={product.id}
                productId={product.id}
                name={product.name}
                retailPriceCents={product.priceCents}
                currency={product.currency}
                wholesalePriceCents={product.wholesalePriceCents}
                wholesaleMinQuantity={product.wholesaleMinQuantity}
                imageUrl={product.imageUrl ?? undefined}
                inStock={product.inStock}
                maxQuantity={maxQuantity}
                showExactStock={viewer.isAuthenticated}
                hasVariants={product.hasVariants}
                tenantSlug={tenantSlug}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('purchase.stockConfirmation')}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">{t('aboutThisProduct')}</h2>
              <p className="max-w-prose whitespace-pre-wrap leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {product.description || t('noDescription')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
