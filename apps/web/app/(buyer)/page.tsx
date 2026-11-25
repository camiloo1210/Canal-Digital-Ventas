import * as React from 'react';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { StoreDirectorySearch } from '@/features/store-directory/components/store-directory-search';
import {
  StoreDirectoryResults,
  StoreDirectorySkeleton,
} from '@/features/store-directory/components/store-directory-results';
import { LegacyOrderRedirect } from '@/features/store-directory/components/legacy-order-redirect';
import { Compass } from 'lucide-react';

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
  const t = await getTranslations('BuyerDashboard.directory');
  return (
    <>
      <LegacyOrderRedirect />
      <div className="space-y-10 sm:space-y-12">
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-muted/35 px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full border border-foreground/[0.06] sm:size-96"
          />
          <div className="relative max-w-3xl space-y-7">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Compass aria-hidden="true" className="size-4" />
                {t('eyebrow')}
              </span>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl">
                  {t('title')}
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {t('description')}
                </p>
              </div>
            </div>
            <StoreDirectorySearch query={query} />
          </div>
        </header>
        <Suspense
          key={`${query}-${page}`}
          fallback={<StoreDirectorySkeleton label={t('loading')} />}
        >
          <StoreDirectoryResults page={page} query={query} />
        </Suspense>
      </div>
    </>
  );
}
