import { notFound } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <div className="flex flex-col min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-12">
          <div className="min-w-0">
            <ProductImageCarousel images={galleryImages} alt={product.name} />
          </div>

          <div className="flex flex-col justify-start">
            {product.sku && (
              <span className="text-xs text-muted-foreground mb-2">{product.sku}</span>
            )}

            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">
              {product.name}
            </h1>

            <div className="text-3xl sm:text-4xl font-semibold text-foreground mb-3">
              {formatMoney(product.priceCents, 'USD', locale)}
            </div>

            {product.wholesalePriceCents !== null && product.wholesaleMinQuantity !== null && (
              <div className="mb-5 flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {t('wholesaleBadge')}
                </Badge>
                <span className="text-muted-foreground text-sm font-medium">
                  {formatMoney(product.wholesalePriceCents, 'USD', locale)} ({t('wholesaleMin')}:{' '}
                  {product.wholesaleMinQuantity})
                </span>
              </div>
            )}

            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">{t('availability')}</span>
                <StoreProductStockBadge availability={product.stockAvailability} />
                {viewer.isAuthenticated && purchaseInfo && (
                  <span className="text-sm font-medium text-foreground">
                    {t('purchase.limited', { count: maxQuantity })}
                  </span>
                )}
              </div>
              <AddToCartButton
                key={product.id}
                productId={product.id}
                name={product.name}
                price={product.priceCents / 100}
                imageUrl={product.imageUrl ?? undefined}
                inStock={product.inStock}
                maxQuantity={maxQuantity}
                showExactStock={viewer.isAuthenticated}
                hasVariants={product.hasVariants}
                tenantSlug={tenantSlug}
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('purchase.stockConfirmation')}
              </p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{t('aboutThisProduct')}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                {product.description || t('noDescription')}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
