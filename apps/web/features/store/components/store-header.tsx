'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { StoreViewer } from '@/features/store/queries/store-viewer.query';
import { UserNav } from '@/features/iam/components/user-nav';
import { CartSheet } from '@/features/cart/components/cart-sheet';
import { AppHeader } from '@/components/app-header';

interface StoreHeaderProps {
  viewer: StoreViewer;
  tenantSlug: string;
  tenantName?: string;
  labels: {
    login: string;
    createAccount: string;
    logout: string;
    dashboard: string;
    settings: string;
    backToHome: string;
    backToStore: string;
    cartTitle: string;
    cartEmpty: string;
    cartCheckout: string;
    cartSubtotal: string;
    cartTaxesNote: string;
  };
}

export function StoreHeader({
  viewer,
  tenantSlug,
  tenantName,
  labels,
}: StoreHeaderProps): React.JSX.Element {
  const pathname = usePathname();
  const storeHref = `/store/${tenantSlug}`;
  const isStoreHome = pathname === storeHref || pathname === `${storeHref}/`;
  const backHref = isStoreHome ? '/' : storeHref;
  const backLabel = isStoreHome ? labels.backToHome : labels.backToStore;
  return (
    <AppHeader contentClassName="mx-auto max-w-7xl">
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <Link
          href={backHref}
          className="flex shrink-0 items-center justify-center size-11 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={backLabel}
          title={backLabel}
        >
          <ChevronLeftIcon className="size-5" />
        </Link>

        <div className="h-6 w-px bg-border hidden sm:block mx-1"></div>

        <Link
          href={`/store/${tenantSlug}`}
          className="min-w-0 font-bold text-lg md:text-xl capitalize truncate"
        >
          {tenantName || tenantSlug}
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-4">
        <CartSheet
          labels={{
            title: labels.cartTitle,
            empty: labels.cartEmpty,
            checkout: labels.cartCheckout,
            subtotal: labels.cartSubtotal,
            taxesNote: labels.cartTaxesNote,
          }}
        />
        <UserNav viewer={viewer} redirectTo={pathname} labels={labels} />
      </div>
    </AppHeader>
  );
}
