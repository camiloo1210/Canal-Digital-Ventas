import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppHeader } from '@/components/app-header';
import { BuyerNav } from '@/features/store-directory/components/buyer-nav';
import type { StoreViewer } from '@/features/store/queries/store-viewer.query';
import { BuyerKiviWidget } from '@/features/store-directory/components/buyer-kivi-widget';

interface BuyerShellProps {
  children: React.ReactNode;
  viewer: StoreViewer;
}

export async function BuyerShell({
  children,
  viewer,
}: BuyerShellProps): Promise<React.JSX.Element> {
  const t = await getTranslations('Storefront');
  const tb = await getTranslations('BuyerDashboard.navigation');
  return (
    <div className="buyer-space min-h-screen bg-background text-foreground">
      <Link
        href="#buyer-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:text-primary-foreground print:hidden"
      >
        {t('accessibility.skipToContent')}
      </Link>
      <AppHeader contentClassName="mx-auto max-w-[1200px] gap-1 sm:gap-3">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight sm:text-lg">
          {t('auth.platform')}
        </Link>
        <BuyerNav
          viewer={viewer}
          navLabel={tb('label')}
          tabLabels={{ stores: tb('stores'), purchases: tb('purchases'), profile: tb('profile') }}
          userLabels={{
            login: t('login'),
            createAccount: t('createAccount'),
            logout: t('logout'),
            dashboard: t('dashboard'),
            settings: t('settings'),
          }}
        />
      </AppHeader>
      <main
        id="buyer-main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 print:max-w-none print:p-0"
      >
        {children}
      </main>
      <BuyerKiviWidget />
    </div>
  );
}
