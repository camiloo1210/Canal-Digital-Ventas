import * as React from 'react';
import type { PublicTenantDirectoryResult } from '@canaldigital/packages/core';
import { getTranslations } from 'next-intl/server';
import { listActiveTenantsQuery } from '@/features/iam/queries/list-active-tenants.query';
import { StoreDirectory } from '@/features/store-directory/components/store-directory';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export async function StoreDirectoryResults({
  page,
  query,
}: {
  page: number;
  query: string;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('BuyerDashboard.directory');
  let result: PublicTenantDirectoryResult | null = null;
  try {
    result = await listActiveTenantsQuery(page, 24, query);
  } catch (error: unknown) {
    console.error('[StoreDirectoryResults]', error);
  }
  if (!result) {
    return (
      <Alert>
        <AlertTitle>{t('errorTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t('errorDescription')}</p>
          <form action="/" method="get">
            <input type="hidden" name="storeSearch" value={query} />
            <input type="hidden" name="page" value={page} />
            <Button type="submit" variant="outline" className="mt-3 min-h-11">
              {t('retry')}
            </Button>
          </form>
        </AlertDescription>
      </Alert>
    );
  }
  return <StoreDirectory result={result} query={query} />;
}

export function StoreDirectorySkeleton({ label }: { label: string }): React.JSX.Element {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="space-y-4">
      <Skeleton className="h-6 w-40 motion-reduce:animate-none" />
      <div aria-hidden="true" className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-80 rounded-xl motion-reduce:animate-none lg:col-span-7" />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          <Skeleton className="h-40 rounded-xl motion-reduce:animate-none" />
          <Skeleton className="h-40 rounded-xl motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
