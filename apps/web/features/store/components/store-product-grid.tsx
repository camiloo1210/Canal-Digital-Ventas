import * as React from 'react';
import { PublicProductReadModel } from '@canaldigital/packages/core';
import { formatMoney } from '@/lib/money';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import {
  STORE_PRODUCT_GRID,
  STORE_PRODUCT_CARD,
  STORE_PRODUCT_MEDIA,
} from '@/features/store/components/store-product-layout';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { StoreProductStockBadge } from '@/features/store/components/store-product-stock-badge';
import { getLocale, getTranslations } from 'next-intl/server';

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { PackageOpen, SearchX } from 'lucide-react';

interface StoreProductGridProps {
  tenantSlug: string;
  products: PublicProductReadModel[];
  q?: string;
  categorySlug?: string;
  outOfRange?: boolean;
}

export async function StoreProductGrid({
  products,
  tenantSlug,
  q,
  categorySlug,
  outOfRange,
}: StoreProductGridProps): Promise<React.JSX.Element> {
  const t = await getTranslations('Storefront');
  const locale = await getLocale();

  if (products.length === 0) {
    return (
      <Empty className="min-h-72 rounded-xl border border-dashed bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {q || categorySlug ? (
              <SearchX aria-hidden="true" />
            ) : (
              <PackageOpen aria-hidden="true" />
            )}
          </EmptyMedia>
          <EmptyTitle>
            <h3>
              {t(
                outOfRange
                  ? 'pagination.outOfRange'
                  : q || categorySlug
                    ? 'empty.filteredTitle'
                    : 'empty.catalogTitle',
              )}
            </h3>
          </EmptyTitle>
          <EmptyDescription className="[overflow-wrap:anywhere]">
            {t(
              q
                ? 'empty.searchDescription'
                : categorySlug
                  ? 'empty.categoryDescription'
                  : outOfRange
                    ? 'empty.pageDescription'
                    : 'empty.catalogDescription',
              { query: q ?? '' },
            )}
          </EmptyDescription>
        </EmptyHeader>
        {(q || categorySlug || outOfRange) && (
          <EmptyContent>
            <Button
              nativeButton={false}
              className="min-h-11"
              render={<Link href={`/store/${tenantSlug}`} />}
            >
              {t(q || categorySlug ? 'empty.clearFilters' : 'empty.firstPage')}
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <div className={STORE_PRODUCT_GRID}>
        {products.map((product): React.JSX.Element => (
          <Link
            key={product.id}
            href={`/store/${tenantSlug}/products/${product.id}`}
            className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <Card
              className={`${STORE_PRODUCT_CARD} group transition-shadow hover:shadow-sm motion-reduce:transition-none`}
            >
              <div className={STORE_PRODUCT_MEDIA}>
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.02] motion-reduce:transition-none"
                    sizes="(min-width: 1280px) 286px, (min-width: 1024px) calc((100vw - 112px) / 3), (min-width: 640px) calc((100vw - 72px) / 2), (min-width: 360px) calc((100vw - 48px) / 2), calc(100vw - 32px)"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-foreground">
                    <span className="px-3 text-center text-xs">{t('noImage')}</span>
                  </div>
                )}
              </div>

              <CardContent className="flex flex-1 flex-col gap-3 p-(--card-spacing)">
                <CardTitle className="min-h-10 text-sm font-medium leading-5" title={product.name}>
                  <h3 className="line-clamp-2 [overflow-wrap:anywhere]">{product.name}</h3>
                </CardTitle>
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 max-w-full text-lg font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">
                      {formatMoney(product.priceCents, 'USD', locale)}
                    </span>
                    <StoreProductStockBadge availability={product.stockAvailability} />
                  </div>
                  {product.wholesalePriceCents !== null &&
                    product.wholesaleMinQuantity !== null && (
                      <div className="flex flex-col items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                        <Badge variant="secondary">{t('wholesaleBadge')}</Badge>
                        <span>
                          {formatMoney(product.wholesalePriceCents, 'USD', locale)} (
                          {t('wholesaleMin')}: {product.wholesaleMinQuantity})
                        </span>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
