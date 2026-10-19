import * as React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AppHeader } from '@/components/app-header';
import { UserNav } from '@/features/iam/components/user-nav';
import type { StoreViewer } from '@/features/store/queries/store-viewer.query';
import { cn } from '@/lib/utils';

interface BuyerShellProps {
  children: React.ReactNode;
  active: 'stores' | 'purchases';
  viewer: StoreViewer;
}

export async function BuyerShell({
  children,
  active,
  viewer,
}: BuyerShellProps): Promise<React.JSX.Element> {
  const t = await getTranslations('Storefront');
  const tb = await getTranslations('BuyerDashboard.navigation');
  return (
    <div className="buyer-space min-h-screen bg-background text-foreground">
      <Link
        href="#buyer-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:text-primary-foreground"
      >
        {t('accessibility.skipToContent')}
      </Link>
      <AppHeader contentClassName="mx-auto max-w-[1200px] gap-1 sm:gap-3">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight sm:text-lg">
          {t('auth.platform')}
        </Link>
        <nav aria-label={tb('label')} className="ml-auto flex items-center gap-1 sm:gap-4">
          {(
            [
              { href: '/', key: 'stores' },
              { href: '/purchases', key: 'purchases' },
            ] as const
          ).map((item): React.JSX.Element => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center whitespace-nowrap rounded-md px-2 text-xs transition-colors hover:text-foreground motion-reduce:transition-none sm:px-3 sm:text-sm',
                active === item.key ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {tb(item.key)}
            </Link>
          ))}
        </nav>
        <UserNav
          viewer={viewer}
          redirectTo={active === 'purchases' ? '/purchases' : '/'}
          labels={{
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
        className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}
