import * as React from 'react';
import { Store, Search } from 'lucide-react';
import Link from 'next/link';
import type {
  PublicTenantDirectoryItem,
  PublicTenantDirectoryResult,
} from '@canaldigital/packages/core';
import { StoreDirectoryCard } from '@/features/store-directory/components/store-directory-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface StoreDirectoryProps {
  result: PublicTenantDirectoryResult;
  query: string;
  labels: {
    title: string;
    empty: string;
    visit: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchButton: string;
    clearSearch: string;
    noResults: string;
    resultCount: string;
    previous: string;
    next: string;
    pagination: string;
  };
}

export function StoreDirectory({ result, query, labels }: StoreDirectoryProps): React.JSX.Element {
  const pageHref = (page: number): string => {
    const params = new URLSearchParams();
    if (query) params.set('storeSearch', query);
    params.set('page', String(page));
    return `/?${params.toString()}`;
  };
  return (
    <section>
      <div className="flex items-center gap-2 mb-6">
        <Store className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">{labels.title}</h2>
      </div>

      <form
        action="/"
        method="get"
        role="search"
        aria-label={labels.searchLabel}
        className="mb-3 flex flex-wrap items-center gap-3"
      >
        <Label htmlFor="store-directory-search" className="sr-only">
          {labels.searchLabel}
        </Label>
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="store-directory-search"
            type="search"
            name="storeSearch"
            defaultValue={query}
            key={query}
            maxLength={100}
            placeholder={labels.searchPlaceholder}
            className="pl-9"
          />
        </div>
        <Button type="submit">{labels.searchButton}</Button>
        {query && (
          <Link href="/" className="text-sm underline underline-offset-4">
            {labels.clearSearch}
          </Link>
        )}
      </form>
      {query && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {labels.resultCount}
        </p>
      )}

      {result.items.length === 0 ? (
        <div className="bg-card rounded-lg shadow-sm border border-border p-12 text-center text-muted-foreground">
          {query ? labels.noResults : labels.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {result.items.map((tenant: PublicTenantDirectoryItem): React.JSX.Element => (
            <StoreDirectoryCard key={tenant.slug} tenant={tenant} visitLabel={labels.visit} />
          ))}
        </div>
      )}

      {result.totalPages > 1 && (
        <nav
          aria-label={labels.pagination}
          className="mt-6 flex items-center justify-between gap-4"
        >
          {result.currentPage > 1 ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={pageHref(result.currentPage - 1)} />}
            >
              {labels.previous}
            </Button>
          ) : (
            <span />
          )}
          {result.currentPage < result.totalPages && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={pageHref(result.currentPage + 1)} />}
            >
              {labels.next}
            </Button>
          )}
        </nav>
      )}
    </section>
  );
}
