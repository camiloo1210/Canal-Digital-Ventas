import Link from 'next/link';
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { AdminProductCatalogItem } from '@canaldigital/packages/core';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { CatalogStatusBadge } from '@/features/dashboard/components/catalog-status-badge';
import { ProductCardActions } from '@/features/products/components/product-card-actions';
import { formatMoney } from '@/lib/money';

function ProductThumbnail({ product }: { product: AdminProductCatalogItem }): React.JSX.Element {
  return (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted/40">
      {product.imageUrl ? (
        <Image src={product.imageUrl} alt="" fill sizes="48px" className="object-contain" />
      ) : (
        <ImageIcon aria-hidden="true" className="m-3 size-6 text-muted-foreground" />
      )}
    </div>
  );
}

export async function ProductCatalogTable({
  items,
}: {
  items: AdminProductCatalogItem[];
}): Promise<React.JSX.Element> {
  const [t, locale] = await Promise.all([getTranslations('AdminCatalog'), getLocale()]);
  const number = new Intl.NumberFormat(locale);
  const editHref = (id: string): string => '/dashboard/catalog/products/' + id + '/edit';
  return (
    <>
      <div className="hidden xl:block">
        <Table className="table-fixed">
          <caption className="sr-only">{t('productsTitle')}</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-[35%] pl-5">
                {t('product')}
              </TableHead>
              <TableHead scope="col" className="w-[18%]">
                {t('category')}
              </TableHead>
              <TableHead scope="col" className="w-[16%] text-right">
                {t('price')}
              </TableHead>
              <TableHead scope="col" className="w-[10%] text-right">
                {t('stock')}
              </TableHead>
              <TableHead scope="col" className="w-[15%]">
                {t('status')}
              </TableHead>
              <TableHead scope="col" className="w-16 pr-5">
                <span className="sr-only">{t('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((product): React.JSX.Element => (
              <TableRow key={product.id}>
                <TableCell className="py-4 pl-5 whitespace-normal">
                  <div className="flex items-center gap-3">
                    <ProductThumbnail product={product} />
                    <div className="min-w-0">
                      <Link
                        href={editHref(product.id)}
                        className="inline-flex min-h-11 items-center break-words font-medium underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                      >
                        {product.name}
                      </Link>
                      <p className="break-all text-xs text-muted-foreground">
                        {t('sku')}: {product.sku || t('notProvided')}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal break-words">
                  {product.categoryName}
                </TableCell>
                <TableCell className="text-right whitespace-normal font-medium tabular-nums">
                  {formatMoney(product.priceCents, product.currency, locale)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {number.format(product.stock)}
                </TableCell>
                <TableCell>
                  <CatalogStatusBadge status={product.status} label={t(product.status)} />
                </TableCell>
                <TableCell className="pr-5">
                  <ProductCardActions
                    productId={product.id}
                    status={product.status}
                    productName={product.name}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y xl:hidden">
        {items.map((product): React.JSX.Element => (
          <li key={product.id} className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ProductThumbnail product={product} />
              <div className="min-w-0 flex-1">
                <Link
                  href={editHref(product.id)}
                  className="inline-flex min-h-11 items-center break-words text-sm font-semibold underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                >
                  {product.name}
                </Link>
                <p className="break-all text-xs text-muted-foreground">
                  {t('sku')}: {product.sku || t('notProvided')}
                </p>
              </div>
              <ProductCardActions
                productId={product.id}
                status={product.status}
                productName={product.name}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 break-words text-sm text-muted-foreground">
                {product.categoryName}
              </p>
              <CatalogStatusBadge status={product.status} label={t(product.status)} />
            </div>
            <dl className="flex flex-wrap justify-between gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('price')}</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {formatMoney(product.priceCents, product.currency, locale)}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-muted-foreground">{t('stock')}</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {t('units', { count: product.stock })}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
