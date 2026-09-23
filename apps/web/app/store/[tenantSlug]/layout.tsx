import * as React from 'react';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';
import { StoreHeader } from '@/features/store/components/store-header';
import { getTranslations } from 'next-intl/server';

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  
  const viewer = await getStoreViewerQuery();
  const t = await getTranslations('Storefront');

  const labels = {
    login: t('login'),
    createAccount: t('createAccount'),
    logout: t('logout'),
    dashboard: t('dashboard'),
    settings: t('settings'),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StoreHeader viewer={viewer} tenantSlug={tenantSlug} labels={labels} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
