import * as React from 'react';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export async function StoreDirectorySearch({
  query,
}: {
  query: string;
}): Promise<React.JSX.Element> {
  const t = await getTranslations('BuyerDashboard');
  return (
    <form
      action="/"
      method="get"
      role="search"
      aria-label={t('search_stores_label')}
      className="max-w-2xl space-y-2.5"
    >
      <Label htmlFor="store-directory-search" className="text-sm font-medium">
        {t('search_stores_label')}
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="store-directory-search"
            type="search"
            name="storeSearch"
            defaultValue={query}
            key={query}
            maxLength={100}
            placeholder={t('search_stores_placeholder')}
            className="h-12 rounded-xl bg-background pl-10 shadow-sm"
          />
        </div>
        <Button type="submit" className="h-12 rounded-xl px-5">
          {t('search_stores_button')}
        </Button>
        {query && (
          <Button
            variant="ghost"
            nativeButton={false}
            role="link"
            className="min-h-11"
            render={<Link href="/" />}
          >
            {t('clear_store_search')}
          </Button>
        )}
      </div>
    </form>
  );
}
