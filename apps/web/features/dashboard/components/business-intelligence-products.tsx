'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { IntelligenceProductResult, IntelligenceSignal } from '@canaldigital/packages/core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  intelligenceMoney,
  intelligencePercent,
} from '@/features/dashboard/components/business-intelligence-format';

type ProductSort = 'revenue' | 'units' | 'profit' | 'coverage' | 'lowestProfit';
const sorts: readonly ProductSort[] = ['revenue', 'units', 'profit', 'lowestProfit', 'coverage'];
const signals: readonly IntelligenceSignal[] = [
  'outOfStock',
  'restock',
  'noSales',
  'lowMargin',
  'healthy',
  'inactive',
  'variants',
];
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/** Presentation-only sorting/search. Commercial signals and quantities come from Core. */
export function visibleIntelligenceProducts(
  products: readonly IntelligenceProductResult[],
  search: string,
  signal: IntelligenceSignal | 'all',
  sort: ProductSort,
): IntelligenceProductResult[] {
  const needle = normalize(search.trim());
  return products
    .filter(
      (product): boolean =>
        (signal === 'all' || product.signal === signal) &&
        normalize(`${product.name} ${product.sku} ${product.category}`).includes(needle),
    )
    .sort((a, b): number => {
      if (sort === 'coverage')
        return (
          (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity) ||
          a.name.localeCompare(b.name)
        );
      if (sort === 'lowestProfit')
        return a.estimatedProfitCents - b.estimatedProfitCents || a.name.localeCompare(b.name);
      const key =
        sort === 'units'
          ? 'unitsSold'
          : sort === 'profit'
            ? 'estimatedProfitCents'
            : 'revenueCents';
      return b[key] - a[key] || a.name.localeCompare(b.name);
    });
}

function ProductsTable({
  products,
  currency,
  inventory,
  empty,
}: {
  products: readonly IntelligenceProductResult[];
  currency: string;
  inventory: boolean;
  empty: string;
}): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  const locale = useLocale();
  const columns = inventory
    ? (['product', 'stock', 'coverage', 'suggested', 'signal'] as const)
    : (['product', 'units', 'revenue', 'profit', 'margin', 'signal'] as const);
  return (
    <div className="min-w-0">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column): React.JSX.Element => (
              <TableHead
                key={column}
                className={column === 'product' || column === 'signal' ? '' : 'text-right'}
              >
                {t(column)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product): React.JSX.Element => (
            <TableRow key={product.id}>
              <TableCell className="min-w-40 max-w-64 whitespace-normal">
                <Link
                  href={`/dashboard/catalog/products/${product.id}/edit`}
                  className="inline-flex min-h-11 items-center font-medium leading-5 text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {product.name}
                </Link>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {product.sku} · {product.category}
                </p>
              </TableCell>
              {inventory ? (
                <>
                  <TableCell className="text-right tabular-nums">
                    {product.hasVariants ? t('unavailable') : product.stock}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {product.coverageDays === null
                      ? t('unavailable')
                      : t('daysShort', { count: product.coverageDays })}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {product.restockUnits > 0 ? product.restockUnits : t('unavailable')}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">{product.unitsSold}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {intelligenceMoney(product.revenueCents, currency, locale)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${product.estimatedProfitCents < 0 ? 'text-destructive' : ''}`}
                  >
                    {intelligenceMoney(product.estimatedProfitCents, currency, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {product.marginBps === null
                      ? t('unavailable')
                      : intelligencePercent(product.marginBps, locale)}
                  </TableCell>
                </>
              )}
              <TableCell>
                <Badge
                  variant={
                    product.signal === 'outOfStock' || product.signal === 'restock'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {t(`signals.${product.signal}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {products.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-28 text-center text-muted-foreground"
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function BusinessIntelligenceProducts({
  products,
  currency,
}: {
  products: readonly IntelligenceProductResult[];
  currency: string;
}): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  const [search, setSearch] = React.useState('');
  const [signal, setSignal] = React.useState<IntelligenceSignal | 'all'>('all');
  const [sort, setSort] = React.useState<ProductSort>('revenue');
  const [page, setPage] = React.useState(0);
  const visible = visibleIntelligenceProducts(products, search, signal, sort);
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(visible.length / 20) - 1));
  const rows = visible.slice(pageIndex * 20, (pageIndex + 1) * 20);
  return (
    <Card id="bi-products" className="min-w-0 scroll-mt-20 sm:[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle>{t('productsTitle')}</CardTitle>
        <CardDescription>{t('productsHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="grid min-w-0 gap-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="bi-search">{t('search')}</Label>
            <Input
              id="bi-search"
              type="search"
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                setSearch(event.target.value);
                setPage(0);
              }}
              className="min-h-11"
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="bi-signal">{t('signal')}</Label>
            <Select
              value={signal}
              items={[
                { value: 'all', label: t('all') },
                ...signals.map((value): { value: string; label: string } => ({
                  value,
                  label: t(`signals.${value}`),
                })),
              ]}
              onValueChange={(value: string | null): void => {
                const next =
                  value === 'all' ? 'all' : signals.find((signal): boolean => signal === value);
                if (next !== undefined) {
                  setSignal(next);
                  setPage(0);
                }
              }}
            >
              <SelectTrigger id="bi-signal" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {signals.map((value): React.JSX.Element => (
                  <SelectItem key={value} value={value}>
                    {t(`signals.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="bi-sort">{t('sort')}</Label>
            <Select
              value={sort}
              items={sorts.map((value): { value: string; label: string } => ({
                value,
                label: t(`sorts.${value}`),
              }))}
              onValueChange={(value: string | null): void => {
                const next = sorts.find((sort): boolean => sort === value);
                if (next !== undefined) {
                  setSort(next);
                  setPage(0);
                }
              }}
            >
              <SelectTrigger id="bi-sort" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sorts.map((value): React.JSX.Element => (
                  <SelectItem key={value} value={value}>
                    {t(`sorts.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Tabs defaultValue="performance" className="min-w-0 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="h-auto min-h-12" aria-label={t('catalogView')}>
              <TabsTrigger value="performance" className="min-h-11 px-4">
                {t('performanceView')}
              </TabsTrigger>
              <TabsTrigger value="inventory" className="min-h-11 px-4">
                {t('inventoryView')}
              </TabsTrigger>
            </TabsList>
            <p role="status" className="text-xs text-muted-foreground">
              {t('results', { count: visible.length })}
            </p>
          </div>
          <TabsContent value="performance" className="min-w-0">
            <ProductsTable
              products={rows}
              currency={currency}
              inventory={false}
              empty={t(products.length === 0 ? 'noProducts' : 'noMatches')}
            />
          </TabsContent>
          <TabsContent value="inventory" className="min-w-0">
            <p className="mb-3 text-sm text-muted-foreground">{t('inventoryViewHelp')}</p>
            <ProductsTable
              products={rows}
              currency={currency}
              inventory
              empty={t(products.length === 0 ? 'noProducts' : 'noMatches')}
            />
          </TabsContent>
        </Tabs>
        {visible.length > 20 && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pageIndex === 0}
              onClick={(): void => setPage(pageIndex - 1)}
            >
              {t('previous')}
            </Button>
            <span className="text-sm">
              {t('page', { current: pageIndex + 1, total: Math.ceil(visible.length / 20) })}
            </span>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={(pageIndex + 1) * 20 >= visible.length}
              onClick={(): void => setPage(pageIndex + 1)}
            >
              {t('next')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
