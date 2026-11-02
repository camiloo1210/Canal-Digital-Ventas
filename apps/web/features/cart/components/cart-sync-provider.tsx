'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useCartStore } from '@/features/cart/store/cart.store';
import { createCartSyncController } from '@/features/cart/sync/cart-sync.controller';
import { registerActiveCartSync } from '@/features/cart/sync/cart-session';

interface CartSyncProviderProps {
  tenantSlug: string;
  isAuthenticated: boolean;
}

interface DroppedNotice {
  names: string[];
  count: number;
}

/** Keeps the local cart and the server cart of an authenticated buyer in sync. Guests: no-op. */
export function CartSyncProvider({
  tenantSlug,
  isAuthenticated,
}: CartSyncProviderProps): React.JSX.Element | null {
  const t = useTranslations('Storefront.cartSync');
  const [notice, setNotice] = React.useState<DroppedNotice | null>(null);

  React.useEffect((): (() => void) | void => {
    if (!isAuthenticated) return;
    const controller = createCartSyncController({
      tenantSlug,
      store: useCartStore,
      fetchFn: (input, init): Promise<Response> => fetch(input, init),
      sendBeacon:
        typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
          ? (url: string, data: Blob): boolean => navigator.sendBeacon(url, data)
          : null,
      onDropped: setNotice,
    });
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') controller.flush();
      else controller.markVisible();
    };
    const onPageHide = (): void => controller.flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    registerActiveCartSync(controller);
    void controller.start();
    return (): void => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      controller.flush();
      controller.stop();
      registerActiveCartSync(null);
    };
  }, [tenantSlug, isAuthenticated]);

  if (!isAuthenticated || !notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
    >
      <p className="flex-1">
        {notice.names.length > 0
          ? t('dropped', { names: notice.names.join(', ') })
          : t('droppedGeneric')}
      </p>
      <button
        type="button"
        aria-label={t('dismiss')}
        onClick={(): void => setNotice(null)}
        className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
