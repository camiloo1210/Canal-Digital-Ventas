import * as React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { getTranslations } from 'next-intl/server';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

interface StorePaginationProps {
  tenantSlug: string;
  currentPage: number;
  totalPages: number;
  q?: string;
  categorySlug?: string;
}

export async function StorePagination({
  tenantSlug,
  currentPage,
  totalPages,
  q,
  categorySlug,
}: StorePaginationProps): Promise<React.JSX.Element | null> {
  const t = await getTranslations('Storefront.pagination');
  if (totalPages <= 1 && currentPage <= 1) return null;
  const href = (page: number): string => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (categorySlug) params.set('category', categorySlug);
    params.set('page', String(page));
    return `/store/${tenantSlug}?${params}`;
  };
  return (
    <Pagination className="mt-8" aria-label={t('label')}>
      <PaginationContent>
        <PaginationItem>
          {currentPage > 1 ? (
            <PaginationLink
              href={href(Math.min(currentPage - 1, Math.max(1, totalPages)))}
              rel="prev"
            >
              <ChevronLeftIcon aria-hidden="true" />
              {t('previous')}
            </PaginationLink>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-11 items-center gap-2 px-2.5 text-sm text-muted-foreground"
            >
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
              {t('previous')}
            </span>
          )}
        </PaginationItem>
        <PaginationItem>
          <span aria-current="page" className="px-2 text-sm">
            {currentPage > totalPages
              ? t('outOfRange')
              : t('page', { current: currentPage, total: totalPages })}
          </span>
        </PaginationItem>
        <PaginationItem>
          {currentPage < totalPages ? (
            <PaginationLink href={href(currentPage + 1)} rel="next">
              {t('next')}
              <ChevronRightIcon aria-hidden="true" />
            </PaginationLink>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-11 items-center gap-2 px-2.5 text-sm text-muted-foreground"
            >
              {t('next')}
              <ChevronRightIcon aria-hidden="true" className="size-4" />
            </span>
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
