import * as React from 'react';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { getTranslations } from 'next-intl/server';
import { BuyerShell } from '@/features/store-directory/components/buyer-shell';
import { StoreDirectorySearch } from '@/features/store-directory/components/store-directory-search';
import {
  StoreDirectoryResults,
  StoreDirectorySkeleton,
} from '@/features/store-directory/components/store-directory-results';
import { LegacyOrderRedirect } from '@/features/store-directory/components/legacy-order-redirect';

export async function generateMetadata(): Promise<{ title: string }> {
  const t = await getTranslations('BuyerDashboard.directory');
  return { title: `${t('title')} | Canal Digital` };
}

export default async function BuyerHomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const searchParams = await props.searchParams;
  const requestedPage = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const query =
    typeof searchParams.storeSearch === 'string'
      ? searchParams.storeSearch.trim().slice(0, 100)
      : '';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const viewer = await getStoreViewerQuery();
  const t = await getTranslations('BuyerDashboard.directory');
  return (
    <BuyerShell active="stores" viewer={viewer}>
      <LegacyOrderRedirect />
      <div className="space-y-8">
        <header className="max-w-2xl space-y-3">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[2rem]">
            {t('title')}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t('description')}</p>
        </header>
        <StoreDirectorySearch query={query} />
        <Suspense
          key={`${query}-${page}`}
          fallback={<StoreDirectorySkeleton label={t('loading')} />}
        >
          <StoreDirectoryResults page={page} query={query} />
        </Suspense>
      </div>
    </BuyerShell>
  );
}
