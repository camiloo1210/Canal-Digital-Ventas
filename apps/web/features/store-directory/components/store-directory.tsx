import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type {
  PublicTenantDirectoryItem,
  PublicTenantDirectoryResult,
} from '@canaldigital/packages/core';
import { StoreDirectoryCard } from '@/features/store-directory/components/store-directory-card';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface StoreDirectoryProps {
  result: PublicTenantDirectoryResult;
  query: string;
}

export async function StoreDirectory({
  result,
  query,
}: StoreDirectoryProps): Promise<React.JSX.Element> {
  const t = await getTranslations('BuyerDashboard');
  const td = await getTranslations('BuyerDashboard.directory');
  const pageHref = (page: number): string => {
    const params = new URLSearchParams();
    if (query) params.set('storeSearch', query);
    params.set('page', String(page));
    return `/?${params.toString()}`;
  };
  const renderStore = (tenant: PublicTenantDirectoryItem, prominent = false): React.JSX.Element => (
    <StoreDirectoryCard
      key={tenant.slug}
      tenant={tenant}
      visitLabel={t('visit_store')}
      descriptionFallback={td('storeDescription')}
      prominent={prominent}
    />
  );
  const showcase = result.items.length >= 3 && Boolean(result.items[0]?.bannerUrl);
  const rest = showcase ? result.items.slice(3) : result.items;
  return (
    <section aria-labelledby="store-directory-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="store-directory-title" className="text-lg font-semibold tracking-tight">
          {td(query ? 'searchTitle' : 'allStores')}
        </h2>
        <p role="status" aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
          {t('store_results', { count: result.total })}
        </p>
      </div>
      {query && (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {td('query', { query })}
        </p>
      )}
      {result.items.length === 0 ? (
        <Empty className="min-h-56 rounded-xl border border-dashed bg-muted/20">
          <EmptyHeader>
            <EmptyTitle>
              {td(result.total > 0 ? 'outOfRange' : query ? 'emptySearchTitle' : 'emptyTitle')}
            </EmptyTitle>
            <EmptyDescription>
              {query ? t('no_matching_stores') : t('empty_stores')}
            </EmptyDescription>
          </EmptyHeader>
          {(query || result.total > 0) && (
            <EmptyContent>
              <Button
                nativeButton={false}
                role="link"
                className="min-h-11"
                render={<Link href="/" />}
              >
                {td('allStores')}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          {/* Desktop: 7 + 5 columns. Two compact shops balance one real cover; no fabricated cover slots. */}
          {showcase && (
            <div className="grid items-stretch gap-4 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-7">{renderStore(result.items[0]!, true)}</div>
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:grid-rows-2">
                {result.items.slice(1, 3).map((tenant): React.JSX.Element => renderStore(tenant))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div
              className={cn(
                'grid items-stretch gap-4',
                rest.length === 2
                  ? 'md:grid-cols-2'
                  : rest.length > 2
                    ? 'md:grid-cols-2 lg:grid-cols-3'
                    : undefined,
              )}
            >
              {rest.map((tenant): React.JSX.Element => renderStore(tenant))}
            </div>
          )}
        </>
      )}
      {result.totalPages > 1 && (
        <Pagination aria-label={t('store_pagination')} className="justify-start pt-4">
          <PaginationContent>
            {result.currentPage > 1 && (
              <PaginationItem>
                <PaginationLink
                  href={pageHref(Math.min(result.totalPages, result.currentPage - 1))}
                  className="min-h-11 w-auto px-4"
                  rel="prev"
                >
                  {t('previous_stores')}
                </PaginationLink>
              </PaginationItem>
            )}
            <PaginationItem>
              <span className="px-3 text-sm tabular-nums text-muted-foreground">
                {td('page', { current: result.currentPage, total: result.totalPages })}
              </span>
            </PaginationItem>
            {result.currentPage < result.totalPages && (
              <PaginationItem>
                <PaginationLink
                  href={pageHref(result.currentPage + 1)}
                  className="min-h-11 w-auto px-4"
                  rel="next"
                >
                  {t('next_stores')}
                </PaginationLink>
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </section>
  );
}
