'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
    back: string;
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
  const router = useRouter();
  return (
    <AppHeader>
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={() => router.back()}
          type="button"
          className="flex items-center justify-center size-8 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label={labels.back}
          title={labels.back}
        >
          <ChevronLeftIcon className="size-5" />
        </button>

        <div className="h-6 w-px bg-border hidden sm:block mx-1"></div>

        <Link
          href={`/store/${tenantSlug}`}
          className="font-bold text-lg md:text-xl capitalize truncate max-w-[200px] sm:max-w-none"
        >
          {tenantName || tenantSlug}
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <CartSheet
          labels={{
            title: labels.cartTitle,
            empty: labels.cartEmpty,
            checkout: labels.cartCheckout,
            subtotal: labels.cartSubtotal,
            taxesNote: labels.cartTaxesNote,
          }}
        />
        <UserNav viewer={viewer} redirectTo={`/store/${tenantSlug}`} labels={labels} />
      </div>
    </AppHeader>
  );
}
