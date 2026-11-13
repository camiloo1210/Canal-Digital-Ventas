'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserNav } from '@/features/iam/components/user-nav';
import type { StoreViewer } from '@/features/store/queries/store-viewer.query';

type BuyerTab = 'stores' | 'purchases' | 'profile';

interface BuyerNavProps {
  viewer: StoreViewer;
  navLabel: string;
  tabLabels: Record<BuyerTab, string>;
  userLabels: {
    login: string;
    createAccount: string;
    logout: string;
    dashboard: string;
    settings: string;
  };
}

const TABS: ReadonlyArray<{ href: string; key: BuyerTab }> = [
  { href: '/', key: 'stores' },
  { href: '/purchases', key: 'purchases' },
  { href: '/account/profile', key: 'profile' },
];

function activeTab(pathname: string): BuyerTab {
  if (pathname.startsWith('/purchases')) return 'purchases';
  if (pathname.startsWith('/account/profile')) return 'profile';
  return 'stores';
}

/** Header navigation derived from the URL so the persistent layout can highlight the tab. */
export function BuyerNav({
  viewer,
  navLabel,
  tabLabels,
  userLabels,
}: BuyerNavProps): React.JSX.Element {
  const active = activeTab(usePathname());
  const redirectTo = TABS.find((tab): boolean => tab.key === active)?.href ?? '/';
  return (
    <>
      <nav aria-label={navLabel} className="ml-auto flex items-center gap-1 sm:gap-4">
        {TABS.map((item): React.JSX.Element => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center whitespace-nowrap rounded-md px-2 text-xs transition-colors hover:text-foreground motion-reduce:transition-none sm:px-3 sm:text-sm',
              active === item.key ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {tabLabels[item.key]}
          </Link>
        ))}
      </nav>
      <UserNav viewer={viewer} redirectTo={redirectTo} labels={userLabels} />
    </>
  );
}
