import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AdminCatalogQuery } from '@canaldigital/packages/core';
import { catalogHref, type CatalogKind } from '@/features/dashboard/queries/catalog-query';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';

export async function CatalogPagination({
  kind,
  query,
  totalItems,
  totalPages,
}: {
  kind: CatalogKind;
  query: AdminCatalogQuery;
  totalItems: number;
  totalPages: number;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('AdminCatalog');
  const from = totalItems === 0 ? 0 : (query.page - 1) * query.limit + 1;
  const to = Math.min(query.page * query.limit, totalItems);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-4 sm:px-5">
      <p className="text-sm text-muted-foreground" role="status">
        {t('range', { from, to, total: totalItems })}
      </p>
      <Pagination aria-label={t('pagination')} className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            {query.page > 1 ? (
              <PaginationLink
                href={catalogHref(kind, query, query.page - 1)}
                aria-label={t('previous')}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </PaginationLink>
            ) : (
              <span
                aria-disabled="true"
                aria-label={t('previous')}
                className="inline-flex size-11 items-center justify-center text-muted-foreground/40"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </span>
            )}
          </PaginationItem>
          <PaginationItem>
            <span className="px-2 text-sm tabular-nums">
              {t('page', { current: query.page, total: totalPages })}
            </span>
          </PaginationItem>
          <PaginationItem>
            {query.page < totalPages ? (
              <PaginationLink
                href={catalogHref(kind, query, query.page + 1)}
                aria-label={t('next')}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </PaginationLink>
            ) : (
              <span
                aria-disabled="true"
                aria-label={t('next')}
                className="inline-flex size-11 items-center justify-center text-muted-foreground/40"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
